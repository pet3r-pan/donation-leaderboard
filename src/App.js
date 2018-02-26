import React, { Component } from 'react';
import './App.css';

import Web3 from 'web3'

const donationAddress = '0x9cb8921aa376219950ba134c15d8f5ee2769c599';

//const donationAddress_e = '0x8d12a197cb00d4747a1fe03395095ce2a5cc6819';
const donationNetworkID = 1;  // make sure donations only go through on this network.
const etherscanApiLink = 'https://api.etherscan.io/api?module=account&action=txlist&address='+donationAddress+'&startblock=0&endblock=99999999&sort=asc&apikey=6DIUB7X6S92YJR6KXKF8V8ZU55IXT5PN2S';

const isSearched = searchTerm => item =>
item.from.toLowerCase().includes(searchTerm.toLowerCase());

var myweb3;

class App extends Component {

    constructor(props)  {
    super(props);

    this.state = {
      ethlist: [],
      searchTerm: '',
      donateenabled: true,
      socketconnected: false
    };
  }

  onSearchChange = (event) => {
    this.setState({
      searchTerm: event.target.value
    });
  }

  subscribe = (address) => {
    let ws = new WebSocket('wss://socket.etherscan.io/wshandler');

    function pinger(ws) {
      var timer = setInterval(function() {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify({
            event: "ping"
          }));
        }
      }, 20000);
      return {
        stop: function() {
          clearInterval(timer);
        }
      };
    }

    ws.onopen = function() {
      this.setState({
        socketconnected: true
      });
      pinger(ws);
      ws.send(JSON.stringify({
        event: "txlist",
        address: address
      }));

    }.bind(this);
    ws.onmessage = function(evt) {
      let eventData = JSON.parse(evt.data);
      console.log(eventData);
      if (eventData.event === "txlist"){
        let newTransactionsArray = this.state.transactionsArray.concat(eventData.result);
        this.setState({
          transactionsArray: newTransactionsArray
        }, () => {
          this.processEthList(newTransactionsArray);
        });
      }

    }.bind(this);
    ws.onerror = function(evt) {
      this.setState({
        socketerror: evt.message,
        socketconnected: false
      });
    }.bind(this);
    ws.onclose = function() {
      this.setState({
        socketerror: 'socket closed',
        socketconnected: false
      });
    }.bind(this);
  }

  getAccountData = () => {
    return fetch(`${etherscanApiLink}`)
    .then((originalResponse) => originalResponse.json())
    .then((responseJson) => {
      return responseJson.result;
    });
  }

  handleDonate = (event) => {
      event.preventDefault();
      const form = event.target;
      let donateWei = new myweb3.utils.BN(myweb3.utils.toWei(form.elements['amount'].value, 'ether'));
      let remarks = myweb3.utils.toHex(form.elements['remarks'].value);
      let extraGas = form.elements['remarks'].value.length * 68;

      myweb3.eth.net.getId()
        .then((netId) => {
          switch (netId) {
            case 1:
              console.log('Metamask is on mainnet')
              break
            case 2:
              console.log('Metamask is on the deprecated Morden test network.')
              break
            case 3:
              console.log('Metamask is on the ropsten test network.')
              break
            case 4:
              console.log('Metamask is on the Rinkeby test network.');
              break
            case 42:
              console.log('Metamask is on the Kovan test network.')
              break
            default:
              console.log('Metamask is on an unknown network.')
          }
          if (netId === donationNetworkID){
              return myweb3.eth.getAccounts().then((accounts) => {
                return myweb3.eth.sendTransaction({
                  from: accounts[0],
                  to: donationAddress,
                  value: donateWei,
                  gas : 21000 + extraGas,
                  data: remarks
                }).catch((e)=>{
                  console.log(e);
                });
              });
            }else{
              console.log('no donation allowed on this network');
              this.setState({
                donateenabled: false,
              });
            }
        });
    }


  processEthList = (ethlist) => {
    let filteredEthList = ethlist
      .map((obj) => {
        obj.value = new myweb3.utils.BN(obj.value); // convert string to BigNumber
        return obj;
      })
      .filter((obj) => {
        return obj.value.cmp(new myweb3.utils.BN(0))
      }) // filter out zero-value transactions
      .reduce((acc, cur) => { // group by address and sum tx value
        if (typeof acc[cur.from] === 'undefined') {
          acc[cur.from] = {
            from: cur.from,
            value: new myweb3.utils.BN(0),
            input: cur.input,
            hash: []
          };
        }
        acc[cur.from].value = cur.value.add(acc[cur.from].value);
        acc[cur.from].input = cur.input !== '0x' && cur.input !== '0x00' ? cur.input : acc[cur.from].input;
        acc[cur.from].hash.push(cur.hash);
        return acc;
      }, {});
    filteredEthList = Object.keys(filteredEthList).map((val) => filteredEthList[val])
      .sort((a, b) => { // sort greatest to least
        return b.value.cmp(a.value);
      })
      .map((obj, index) => { // add rank
        obj.rank = index + 1;
        return obj;
      });
    return this.setState({
      ethlist: filteredEthList
    });
  }

  componentDidMount = () => {
    if (typeof window.web3 !== "undefined" && typeof window.web3.currentProvider !== "undefined") {
      myweb3 = new Web3(window.web3.currentProvider);
      myweb3.eth.defaultAccount = window.web3.eth.defaultAccount;
      this.setState({
        candonate: true
      });
    }
    else {
      // I cannot do transactions now.
      this.setState({
        candonate: false
      });
    }

    this.getAccountData().then((res) => {
      this.setState({
        transactionsArray: res
      }, () => {
        this.processEthList(res);
        this.subscribe(donationAddress);
      });
    });
  }

  render = () => {
    return  (
      <div  className="App container-fluid">

      <div className="row justify-content-around">
        <div className="col introColumn">
        <img src="/img/scalingnow.svg" className="typelogo"/>
          <p><a href="https://web3.foundation/">Web3 Foundation</a> and <a href="https//giveth.io">Giveth</a> are hosting an in-person gathering on scaling solutions on <strong>March 5th & 6th in Barcelona</strong>. This application acts as donation gateway and attendee list. </p>
          <p><strong>March 5th</strong> is an invite-only for select devs working on immediate scaling solutions to share their insights amongst one another.</p>
          <p><strong>March 6th</strong> is open to DApp developers who submit a (super quick and easy) <a href="https://docs.google.com/forms/d/1tMq8AamiQ2PI0zulo_jxIV4Ef9h0D9DjrgjfSK70I0M/viewform?edit_requested=true">application</a> on what they are building.</p>
          <p>To help the organizers cover food and facilities cost donations are collected. This application provides a fun way for attendees to register for the event, while incentivizing giving donations.</p>
          <p>Adding a remark to your donation is easy! Just use the MetaMask form on the right if you donated from a MetaMask wallet address or encode a string to hex and send it as input to the donation address.</p>
        </div>
        <div className="col donationColumn">
          <h2>Ways to donate</h2>
          <h4>1. Send a transaction via Metamask</h4>
          <form onSubmit={this.handleDonate}>
            <input
              type="text"
              placeholder="amount to donate in ETH"
              name="amount"
            />
            <input
              type="text"
              name="remarks"
              placeholder="remarks"
            />
            <button className="btn btn-primary">Send</button>
            </form>
            <hr></hr>
            <h4>2. Send directly to donation address</h4>
            <img src="/img/scalingnow-qr.svg" className="qr-code"/>
            <p><strong>{donationAddress}</strong></p>
          </div>
        </div>
        <div className="flex-row">
          <table className="table">
            <thead>
            <tr>
              <th>Rank</th>
              <th>Address</th>
              <th>Value</th>
              <th>Remarks</th>
              <th>Tx Link</th>
            </tr>
            </thead>
            <tbody>

          {this.state.ethlist.filter(isSearched(this.state.searchTerm)).map(item =>

            <tr  key={item.hash} className="Entry">
              <td>{item.rank} </td>
              <td>{item.from} </td>
              <td>{myweb3.utils.fromWei(item.value)} ETH</td>
              <td>{myweb3.utils.hexToAscii(item.input)}</td>
              <td>
                {item.hash.map((txHash, index) =>
                  <a key={index} href={'https://etherscan.io/tx/' + txHash}>[{index + 1}]</a>
                )}
              </td>
            </tr>
          )}
          </tbody>
        </table>

        <form className="Search">
        <input
          type="text"
          onChange={this.onSearchChange}
          placeholder="filter leaderboard"
        />
        </form>

      </div>
    </div>
    );


  } // End of render()


} // End of class App extends Component



export default App;
