const _ = require('lodash')

module.exports.ethCall = async (callPromise) => {
  let returnVal = await callPromise
  
  const assertReturnValue = (expectedReturnVal) => {
    assert.equal(
      returnVal,
      expectedReturnVal,
      `expected ${expectedReturnVal} to be returned, but got ${returnVal}`
    )
  }

  return {
    returnValue: returnVal,
    assertReturnValue
  }
}

module.exports.ethTransaction = async (transactionPromise) => {

  let err, resp
  try {
    resp = await transactionPromise
  } catch (_err) {
    err = _err
  } finally {
    const filterEvents = (event) => {
      return _.filter(resp.logs, { event })
    }
    
    const assertLogEvent = (eventParams) => {
      const events = filterEvents(eventParams.event)
      assert.equal(events.length, 1, `expected 1 ${eventParams.event} event but got ${events.length}`)
      const event = events[0]
      _.forEach(_.keys(eventParams), (p) => {
        if (p !== 'event') {
          assert.equal(
            event.args[p],
            eventParams[p],
            `expected event property '${eventParams.event}.${p}' to be ${eventParams[p]}, ` +
              `but got ${event.args[p]}`
          )
        }
      })
    }

    const assertThrewError = () => {
      assert.equal(
        typeof err === 'undefined',
        false,
        `expected an error, but no error was thrown`
      )
    }
    
    return {
      response: resp,
      error: err,
      filterEvents,
      assertLogEvent,
      assertThrewError
    }
  }

}

