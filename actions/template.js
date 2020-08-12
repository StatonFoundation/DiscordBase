module.exports=Object.freeze({
  /**
   * Action Name Used In Commands.json
   */
  name:'template',
  /**
   * Action Field Key Names Within Commands.json
   */
  fields:[],
  /**
   * Ran Async Function Upon Action Call
   */
  action:async function(cache){
    return console.log(cache.event.args)
  }
})