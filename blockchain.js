
import sha256 from "../node_modules/crypto-js/sha256";
//const sha256 = require('sha256');  //importing sha256 from the path
function Blockchain(){                  // javascript function and constructor
    this.chain = [];                    //creating an empty array called chain
    this.pendingTransactions = [];      //creating empty array to give space for transactions inside the block
    this.networkNodes = [];             //creating empty array to give space for contact list of nodes
    this.currentNodeUrl = currentNodeUrl;
    this.createNewBlock('0',0,'0');     //calling createblock and creating genesis
}

/* a new child function called createnewblock is created. prototype is keyword to accesss properties.
The childfunction here can access the properties from Blockchain constructor */

Blockchain.prototype.createNewBlock = function(hashOfTheBlock,nonceOfTheBlock,prevBlockHash){
    var newBlock = {   
        index:this.chain.length+1,
        transactions:this.pendingTransactions,//we get this from createnew transaction function
        timestamp:Date.now(),          //inbuilt function
        hash:hashOfTheBlock,           //we get this value from generate hash function
        prevBlockHash:prevBlockHash,   //we can get this too from generate hash function
        nonce:nonceOfTheBlock          //we get this from proofofWork function
    };
    //deletes the previous transactions before craeting a block having new transactions
    this.pendingTransactions = [];
    this.chain.push(newBlock);         //pushing the new block to the chain
    return newBlock;    
}
//to get last block's info for prevhash calculation
Blockchain.prototype.getLastBlock = function(){
    var lastBlock = this.chain[this.chain.length-1];
    return lastBlock;
}


//create a transaction and add it to the pending transaction array
Blockchain.prototype.createNewTransaction = function(){
    var newTransactions = {
        sender:document.getElementById('sender').value,
        recipient:document.getElementById('reciever').value,
        amount:document.getElementById('amount').value
    };
    this.pendingTransactions.push(newTransactions);
    return newTransactions;
    document.forms[0].reset();
}

// creating a function just to generate hash
 /* as hash has to be a string we need to give currentblockdata,nonce etc in string format
    so JSON.stringfy is used. 
    here currentblockdata is the pending transactions itself which has to be converted from object format to str
    here nonce is in integer format. so again it has to be converted to str*/

Blockchain.prototype.generateHashOfBlock = function(currentBlockData,nonce,prevBlockHash){
    // hash of a block = data of that block + nonce + previous block hash
    var dataAsString = JSON.stringify(currentBlockData) + nonce.toString() + prevBlockHash;
    console.log('the value of data as string is: ' +dataAsString);
    //var hash = sha256(dataAsString);
    var hash = sha256(dataAsString).toString();
    return hash;                                          // sha256 is a function which has the algo to convert to hash
}
function generateHash(){
    var str = "hello"
    var strhash=sha256(str);
    console.log(strhash);
}
generateHash();

//nonce is an integer and it is the outcome of proof of work. it is a variable needed for hash generation
Blockchain.prototype.proofOfWork = function(currentBlockData,prevBlockHash){
    let nonce = 0;
    var hash = this.generateHashOfBlock(currentBlockData,nonce,prevBlockHash);
while(hash.substring(0,4)!=="0000"){      //here substring is the property of string where it will break the hash from 0th position to 4th
        nonce++;                          //the while loop checks if the substring is = to 0000
        hash = this.generateHashOfBlock(currentBlockData,nonce,prevBlockHash);
}                                //once nonce value changes hash also changes.in case we get the requried hash the while loop breaks
    return nonce;
}
//validating the longest chain
Blockchain.prototype.chainIsValid = function(longestChain){
    let validChain = true;

    for(var i=1;i<longestChain.length;i++){
        const currentBlock = longestChain[i];
        const prevBlock = longestChain[i-1];
        const blockHash = this.generateHashOfBlock(currentBlock['transactions'],currentBlock['nonce'],prevBlock['hash']);
        if(blockHash.substring(0,4)!=="0000"){
            validChain = false;
        }
        if(currentBlock['prevBlockHash'] !== prevBlock['hash']){
            validChain = false;
        }
    }
    const genesisBlock = longestChain[0];
    const correctNonce = genesisBlock['nonce'] === 0;
    const correctPreviousBlockHash = genesisBlock['previousBlockHash'] === '0';
    const correctHash = genesisBlock['hash'] === '0';
    const correctTransactions = genesisBlock['transactions'].length === 0;
    if(!correctNonce || !correctPreviousBlockHash || !correctHash || !correctTransactions){
        validChain = false;
    }
    return validChain; 
}

export default Blockchain;
//module.exports = Blockchain;           //permission to import on other js files