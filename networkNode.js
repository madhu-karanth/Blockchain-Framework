//this file is to retrieve and update the information


var express = require("express");                              //import express js
var cryptoNetworkApp = express();                              //extending the functionality of express to cryptonetworkApp

const bodyParser = require('body-parser');                     //importing body-parser

//use function here is used to mount the specified middleware functions at the path being specified

cryptoNetworkApp.use(bodyParser.json());                       //used to read the request in the body of postman
cryptoNetworkApp.use(bodyParser.urlencoded({ extended: false }));//this does the same as above for the bodies having url

//npm request is used to make http calls 
const rp = require('request-promise');


var port = process.argv[2];                                    //made the port dynamic


var Blockchain = require('./blockchain');                      //imported the blockchain structure we created into the server network
var cryptoChain = new Blockchain();

cryptoNetworkApp.get('/',function(req,res){                    //get function is used to create contents for home page
    res.send('this node belongs to miner 1');                  //sending response to the request
});


cryptoNetworkApp.get('/blockchain',function(req,res){          //endpoint for retrieving the blockchain  
    res.send(cryptoChain);                                   
});

cryptoNetworkApp.post('/transaction',function(req,res){        //this api receives a transaction and adds to pending transactions
    var newTransaction = req.body;
    cryptoChain.pendingTransactions.push(newTransaction);      
});

cryptoNetworkApp.post('/transaction/broadcast',function(req,res){
    var newTransaction = req.body;                             //add the transaction to the pending transactions array
    cryptoChain.pendingTransactions.push(newTransaction);
    const requestPromises = [];
    cryptoChain.networkNodes.forEach(networkNodeUrl => {       //broadcast the transaction info to all other nodes 
        const requestOptions = {
            uri:networkNodeUrl+'/transaction',
            method:'POST',
            body:newTransaction,
            json:true
        };
        requestPromises.push(rp(requestOptions));
    });
    res.json({note:'transaction created and broadcasted successfully'});
});

/* in order to make connections with other nodes, first a node has to post its url/address under register-node endpoint which will be 
sent as data to request in a function. the function processes the request and if it is ok with it, it adds the url under its contact 
list.then it sends the required response*/ 

cryptoNetworkApp.post('/register-node',function(req,res){

    var newNodeUrlToRegister = req.body.newNodeUrl;         //getting the request from the body
    var nodeNotPresentInTheList = cryptoChain.networkNodes.indexOf(newNodeUrlToRegister) == -1; //checks if the url is in contact list
    var notCurrentNode = cryptoChain.currentNodeUrl !== newNodeUrlToRegister;//checks if the url in the request is his url id itself
    if(nodeNotPresentInTheList && notCurrentNode){ //if both the cases are false then it pushes the new contact to contact list
        cryptoChain.networkNodes.push(newNodeUrlToRegister);
        res.json({note:'new node registered successfully'})
    }
});

cryptoNetworkApp.post('/register-nodes-bulk',function(req,res){//foreach is used here to create a loop inside an array which we
    var bulkNetworkNodes = req.body.listOfNodes;               //pass in the body of postman
    bulkNetworkNodes.forEach(networkNodeUrl =>{          
        var nodeNotPresentInTheList = cryptoChain.networkNodes.indexOf(networkNodeUrl) == -1;
        var notCurrentNode = cryptoChain.currentNodeUrl !== networkNodeUrl;
        if(nodeNotPresentInTheList && notCurrentNode){
            const newLocal = cryptoChain.networkNodes.push(networkNodeUrl);
        }
    });
});

cryptoNetworkApp.post('/register-and-broadcast-node',function(req,res){
    const newNodeUrl = req.body.newNodeUrl;     //incoming address of the node that wants to register
    if(cryptoChain.networkNodes.indexOf(newNodeUrl) == -1){ //before broadcasting it saves the incoming contact first
        cryptoChain.networkNodes.push(newNodeUrl);          //checks if the contact is already existing
    }
    const regNodesPromises = [];                            //creating a dummy array
    cryptoChain.networkNodes.forEach(networkNodeUrl => {    //for each contact in the contact list of a node,the address of the new
        const requestOptions = {                            //contact list is sent
            uri:networkNodeUrl+'/register-node',            //under the contact of the contact-list go to their register node
            method:'POST',                                  //post your request
            body:{newNodeUrl:newNodeUrl},                   //the body of the request is the address of the new node
            json:true                                       //to say that all the format is sent in json format
        };
        regNodesPromises.push(rp(requestOptions));
        
    });
    //bulk register all the nodes in the network
    Promise.all(regNodesPromises)
    .then(data=>{
        const bulkRegisterOptions = {
            uri:newNodeUrl+'/register-nodes-bulk',          //sends the contact list to the new node along with contact url of itself
            body:{listOfNodes:[...cryptoChain.networkNodes,cryptoChain.currentNodeUrl]},//3 dots say that they r passing string along
            json:true                                                                    //with an array
        };
        return rp(bulkRegisterOptions);
    })
    .then(data=>{
        res.json({note:'new node registered with network successfully'})
    });
});

//mining process over the network
cryptoNetworkApp.get('/mine',function(req,res){

    //task-1 is to create a new block

    //to create a block you need hash
    //to create hash of the block you need nonce i.e proof of work
    //we also need current block data for all these functions.so we need to convert it to string format first from object format
    var lastBlockInfo = cryptoChain.getLastBlock();
    var prevBlockHash = lastBlockInfo['hash'];
    var currentBlockData = JSON.stringify(cryptoChain.pendingTransactions);
    var nonceOfTheBlock = cryptoChain.proofOfWork(currentBlockData,prevBlockHash);
    var hashOfTheBlock = cryptoChain.generateHashOfBlock(currentBlockData,nonceOfTheBlock,prevBlockHash);
    var newBlock =  cryptoChain.createNewBlock(hashOfTheBlock,nonceOfTheBlock,prevBlockHash);
    res.send(newBlock);

    //task-2 is to broadcast the newly created info to all the nodes and to make the nodes be able to receive it 

    const requestPromises = [];                                 //array where we can get the acknowledgement o
    cryptoChain.networkNodes.forEach(networkNodeUrl => {
        const requestOptions = {
            uri: networkNodeUrl + '/receive-new-block',
            method: 'POST',
            body: {newBlock : newBlock},
            json: true
        };
        requestPromises.push(rp(requestOptions))
    })

    //task-3 is to reward the node which is created and broadcasted the block

    Promise.all(requestPromises)
    .then(data => {
        const requestOptions ={
            uri:cryptoChain.currentNodeUrl + '/transaction/broadcast',
            method:'POST',
            body:{
                amount:6,
                sender:"00",
                recipient:cryptoChain.currentNodeUrl
            },
            json:true
        };
        return rp(requestOptions);
    })
    .then(data => {
        res.json({
            note:"new block mined and broadcasted sucessfully",
            block: newBlock
        })
    });
});

//to build consensus
cryptoNetworkApp.get('/consensus',function(req,res){
    //task 1 is to identify who has the longest chain
    const requestPromises = [];
    //we need to the blockchain from all other nodes in the network except your own
    cryptoChain.networkNodes.forEach(networkNodeUrl =>{
        const requestOptions ={
            uri:networkNodeUrl+'/blockchain',
            method:'GET',
            json:true
        };
        requestPromises.push(rp(requestOptions));
    });
    Promise.all(requestPromises)
    .then(blockchains =>{
        //the part of the chain after which it is corrupted
        const currentChainLength = cryptoChain.chain.length;
        let maxChainlength = currentChainLength;
        let newLongestChain = null;
        //as the transactions keep happening we need to record those too
        //hence we need the variable newPendingtransaction here
        //so assume initally that transactions are nullb
        let newPendingTransactions = null;
        //in the set of blockchains that a node gets from its network nodes,check eho has the 
        //longest chain
        blockchains.forEach(blockchain =>{
            if(block.chain.length > maxChainlength){
                maxChainlength = blockchain.chain.length;
                newLongestChain = blockchain.chain;
                newPendingTransactions = blockchain.pendingTransactions;
            };
        });
    });
    // solving trust issues 
    //validating the longest chain which was found
    //incase newLongestChain is null only
    if(!newLongestChain || (newLongestChain && !cryptoChain.chainIsValid(newLongestChain))){
        //this is to see if newlongestchain is corrupted
        res.send('chain is not replaced as the longest chain is not available or the longest chain is corrupted')
    }
    else{
        //we replace the chain when the longest chain is valid
        cryptoChain.chain = newLongestChain;
        cryptoChain.pendingTransactions = newPendingTransactions;
        res.json({
            note:'this chain has been replaced'
        });
    }
});



//receiving a new block to do validation to check whether the block is legit or not
cryptoNetworkApp.post('/recive-new-block',function(req,res){
    const newBlock = req.body.newBlock;
    const lastBlockInfo = cryptoChain.getLastBlock();
    const correctHash = lastBlockInfo['hash'] === newBlock.prevBlockHash; //correcthash here contains boolean value true or false
    const correctIndex = lastBlockInfo['index']+1 === newBlock['index'];
    if(correctHash && correctIndex){
        cryptoChain.chain.push(newBlock);
        cryptoChain.pendingTransactions=[];
        res.json({note:'new block received'});
    }
    else{
        res.json({note:'error!!'});
    }
});
cryptoNetworkApp.listen(port,function(){                       //listen function is used to activate the server with the mentioned port 
    console.log('the network application is active on port: ' +port);
});