module.exports=Object.freeze({
  /**
   * Action Name Used In Commands.json
   */
  name:''||require('path').basename(__filename).replace('.js', ''),
  /**
   * Action Field Key Names Within Commands.json
   */
  fields:[],
  /**
   * Ran Async Function Upon Action Call
   */
  action:async function(cache){
    console.log('Template Action Ran')
  }
})