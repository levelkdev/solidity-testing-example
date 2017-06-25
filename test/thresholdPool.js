const _ = require('lodash')
const { ethTransaction, ethCall } = require('./helpers')
const ThresholdPoolMock = artifacts.require("./ThresholdPoolMock.sol");
let accounts

contract('ThresholdPool', function(_accounts) {
  accounts = _accounts

  const recipientAccount = accounts[9]
  const init = { poolTime: 100, currentTime: 0, recipient: recipientAccount }

  describe('isClosed()', () => {
    it('should return false when currentTime is less than startTime + poolTime', async () => {
      return await isClosedTest({
        init,
        finalTime: 50,
        expectedReturnVal: false
      })
    })

    it('should return true when currentTime is greater than startTime + poolTime', async () => {
      return await isClosedTest({
        init,
        finalTime: 150,
        expectedReturnVal: true
      })
    })

    it('should return true when currentTime is equal to startTime + poolTime', async () => {
      return await isClosedTest({
        init,
        finalTime: 100,
        expectedReturnVal: true
      })
    })
  })

  describe('thresholdMet()', () => {
    const thresholdMetInit = Object.assign({}, init, { threshold: toWei(0.1) })

    it('should return false when total is less than threshold', async () => {
      return await thresholdMetTest({
        init: thresholdMetInit,
        contributeCalls: [{ sender: accounts[0], value: toWei(0.05) }],
        expectedReturnVal: false
      })
    })
    it('should return true when total is equal to threshold', async () => {
      return await thresholdMetTest({
        init: thresholdMetInit,
        contributeCalls: [{ sender: accounts[0], value: toWei(0.1) }],
        expectedReturnVal: true
      })
    })
    it('should return true when total is greater than threshold', async () => {
      return await thresholdMetTest({
        init: thresholdMetInit,
        contributeCalls: [{ sender: accounts[0], value: toWei(0.15) }],
        expectedReturnVal: true
      })
    })
  })

  describe('contribute()', () => {
    it('should throw when isClosed() is true', async () => {
      return await contributeTest({
        init,
        finalTime: 150,
        contributeCalls: [{
          sender: accounts[0],
          value: 1000
        }],
        expectThrow: true
      })
    })

    it('should throw when payment value is 0', async () => {
      return await contributeTest({
        init,
        contributeCalls: [{
          sender: accounts[0],
          value: 0
        }],
        expectThrow: true
      })
    })

    it('should throw when payment value is less than 0', async () => {
      return await contributeTest({
        init,
        contributeCalls: [{
          sender: accounts[0],
          value: -1000
        }],
        expectThrow: true
      })
    })

    it('should set sender balance to payment amount sent', async () => {
      return await contributeTest({
        init,
        contributeCalls: [{
          sender: accounts[0],
          value: 1000
        }],
        expectedSenderBalances: [{
          sender: accounts[0],
          value: 1000
        }]
      })
    })

    it('should add each payment amount contributed to total', async () => {
      return await contributeTest({
        init,
        contributeCalls: [
          { sender: accounts[0], value: 1000 },
          { sender: accounts[0], value: 2000 },
          { sender: accounts[0], value: 3000 },
          { sender: accounts[1], value: 3000 }
        ],
        expectedTotal: 9000
      })
    })

    it('should mantain cumulative totals for multiple sender contributions', async () => {
      return await contributeTest({
        init,
        contributeCalls: [
          { sender: accounts[0], value: 1000 },
          { sender: accounts[0], value: 2000 },
          { sender: accounts[1], value: 3000 },
          { sender: accounts[1], value: 2000 }
        ],
        expectedSenderBalances: [
          { sender: accounts[0], value: 3000 },
          { sender: accounts[1], value: 5000 }
        ]
      })
    })

  })

  describe('recipientWithdraw()', () => {
    it('should throw if isClosed() returns false', async () => {
      return await recipientWithdrawTest({
        init,
        sender: recipientAccount,
        expectThrow: true
      })
    })
    
    it('should throw if recipientWithdraw has already been called', async () => {
      return await recipientWithdrawTest({
        init,
        finalTime: 150,
        preCall: { account: recipientAccount },
        sender: recipientAccount,
        expectThrow: true
      })
    })
    
    it('should set `recipientWithdrewFunds=true`', async () => {
      return await recipientWithdrawTest({
        init,
        finalTime: 150,
        sender: recipientAccount,
        expectRecipientWithdrewFundsToBeTrue: true
      })
    })

    it('should throw if if total is less than threshold', async () => {
      return await recipientWithdrawTest({
        init: Object.assign({}, init, { threshold: toWei(0.1) }),
        finalTime: 150,
        sender: recipientAccount,
        expectThrow: true
      })
    })

    it('should transfer total to recipient if total is greater than threshold', async () => {
      return await recipientWithdrawTest({
        init: Object.assign({}, init, { threshold: toWei(0.1) }),
        contributeCalls: [
          { sender: accounts[0], value: toWei(0.05) },
          { sender: accounts[1], value: toWei(0.05) },
          { sender: accounts[2], value: toWei(0.05) }
        ],
        finalTime: 150,
        sender: recipientAccount,
        expectedRecipientTransferAmt: toWei(0.15)
      })
    })
    
    it('should throw if call is not from recipient account', async () => {
      return await recipientWithdrawTest({
        init: Object.assign({}, init, { threshold: toWei(0.1) }),
        contributeCalls: [ { sender: accounts[0], value: toWei(0.15) } ],
        finalTime: 150,
        sender: accounts[1],
        expectThrow: true
      })
    })

  })

  describe('withdraw()', async () => {
    const withdrawInit = Object.assign({}, init, { threshold: toWei(0.1) })

    it('should throw if isClosed() returns false', async () => {
      return await withdrawTest({
        init: withdrawInit,
        sender: accounts[0],
        expectThrow: true
      })
    })

    it('should throw if isClosed() returns true and threshold has been met', async () => {
      return await withdrawTest({
        init: withdrawInit,
        sender: accounts[0],
        finalTime: 150,
        contributeCalls: [ { sender: accounts[0], value: toWei(0.15) } ],
        expectThrow: true
      })
    })

    it('should throw if msg.sender balance is 0', async () => {
      return await withdrawTest({
        init: withdrawInit,
        sender: accounts[0],
        finalTime: 150,
        contributeCalls: [ { sender: accounts[1], value: toWei(0.05) } ],
        expectThrow: true
      })
    })

    it('should transfer funds when all conditions are met', async () => {
      return await withdrawTest({
        init: withdrawInit,
        sender: accounts[0],
        finalTime: 150,
        contributeCalls: [ { sender: accounts[0], value: toWei(0.05) } ],
        expectEvents: [
          { event: 'ContributorWithdraw', contributor: accounts[0], value: toWei(0.05) }
        ]
      })
    })
  })

})

async function recipientWithdrawTest (params) {
  const { init, finalTime, contributeCalls,  preCall, sender, expectThrow,
    expectRecipientWithdrewFundsToBeTrue, expectedRecipientTransferAmt } = params
  const tp = await mockTP(init)
  await makeContributeCalls(tp, contributeCalls)
  if (typeof finalTime !== 'undefined') {
    await tp.changeTime(finalTime)
  }
  if (preCall) {
    await tp.recipientWithdraw({ from: preCall.account })
  }
  const tx = await ethTransaction(tp.recipientWithdraw({ from: sender }))
  if (expectThrow) {
    tx.assertThrewError()
  }
  if (typeof expectRecipientWithdrewFundsToBeTrue !== 'undefined') {
    const c = await ethCall(tp.recipientWithdrewFunds.call())
    c.assertReturnValue(true)
  }
  if (typeof expectedRecipientTransferAmt !== 'undefined') {
    tx.assertLogEvent({ event: 'RecipientTransfer', value: expectedRecipientTransferAmt })
  }
}

async function contributeTest (params) {
  const { init, finalTime, contributeCalls, expectThrow, expectedSenderBalances, expectedTotal } = params
  const tp = await tpChangeTime(init, finalTime)
  const transactions = await makeContributeCalls(tp, contributeCalls)
  if (expectThrow) {
    transactions[0].assertThrewError()
  }
  if (typeof expectedSenderBalances !== 'undefined') {
    const actualBalances = await Promise.all(_.map(expectedSenderBalances, (b) => {
      return balanceOf(tp, b.sender)
    }))
    _.forEach(actualBalances, (actualBalance, i) => {
      assert.equal(actualBalance, expectedSenderBalances[i].value)
    })
  }
  if (typeof expectedTotal !== 'undefined') {
    const c = await ethCall(tp.total.call())
    c.assertReturnValue(expectedTotal)
  }
}

async function withdrawTest (params) {
  const { init, finalTime, sender, contributeCalls, expectThrow, expectEvents } = params
  const tp = await mockTP(init)
  await makeContributeCalls(tp, contributeCalls)
  if (typeof finalTime !== 'undefined') {
    await tp.changeTime(finalTime)
  }
  tx = await ethTransaction(tp.withdraw({ from: sender }))
  if (expectThrow) {
    tx.assertThrewError()
  }
  _.forEach(expectEvents, (e) => {
    tx.assertLogEvent(e)
  })
}

async function tpChangeTime (init, finalTime) {
  const tp = await mockTP(init)
  if (finalTime) {
    await tp.changeTime(finalTime)
  }
  return tp
}

async function makeContributeCalls(tp, contributeCalls) {
  if (typeof contributeCalls !== 'undefined') {
    return await Promise.all(_.map(contributeCalls, (c) => {
      return ethTransaction(tp.contribute({ from: c.sender, value: c.value }))
    }))
  }
}

async function isClosedTest (params) {
  const { init, finalTime, expectedReturnVal } = params
  const tp = await mockTP(init)
  await tp.changeTime(finalTime)
  const c = await ethCall(tp.isClosed.call())
  c.assertReturnValue(expectedReturnVal)
}

async function thresholdMetTest (params) {
  const { init, contributeCalls, expectedReturnVal } = params
  const tp = await mockTP(init)
  await makeContributeCalls(tp, contributeCalls)
  const c = await ethCall(tp.thresholdMet.call())
  c.assertReturnValue(expectedReturnVal)
}

async function mockTP (params) {
  const { poolTime, threshold, recipient, currentTime } = params
  return await ThresholdPoolMock.new(
    poolTime,
    threshold,
    recipient,
    currentTime
  )
}

async function balanceOf (tp, address) {
  const b = await tp.balanceOf.call(address)
  return b.toNumber()
}

async function logTP (tp) {
  console.log("")
  console.log("ThresholdPool:")
  console.log("--------------")
  console.log(`BALANCE: ${getBalanceInEth(tp.address)}`)
  console.log(`startTime=${await tp.startTime.call()}`)
  console.log(`poolTime=${await tp.poolTime.call()}`)
  console.log(`threshold=${await tp.threshold.call()}`)
  console.log(`recipient=${await tp.recipient.call()}`)
  console.log(`currentTime()=${await tp.currentTime.call()}`)
  console.log(`isClosed()=${await tp.isClosed.call()}`)
  console.log("")
}

function logBalances (accounts) {
  console.log("")
  _.forEach(accounts, (a, i) => {
    console.log(`${i}: ${getBalanceInEth(a)}`)
  })
  console.log("")
}

function handleErrorAssert (err, expectThrow) {
  const errTestMsg = expectThrow ?
    `expected an error, but no error was thrown` : `unexpected error thrown: ${err}`
  assert.equal(typeof err !== 'undefined', expectThrow ? true : false, errTestMsg)
}

function getBalanceInEth (address) {
  return fromWei(web3.eth.getBalance(address).toNumber())
}

function toWei (n) {
  return web3.toWei(n, 'ether')
}

function fromWei (n) {
  return web3.fromWei(n, 'ether')
}

async function getAccounts() {
  return await new Promise((resolve, reject) => {
    web3.eth.getAccounts((err, accounts) => {
      if (err) {
        reject(err)
      } else {
        resolve(accounts)
      }
    })
  })
}