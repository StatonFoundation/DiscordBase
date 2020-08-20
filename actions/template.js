module.exports=Object.freeze({
  /**
   * Action Name Used In Commands.json
   */
  name:''||require('path').basename(__filename).replace('.js', ''),
  /**
   * Ran Async Function Upon Action Call
   */
  action:async function(cache){
    const {
      
    } = cache[cache.event?'event':'cmd'].actions[cache.index].exclusives;
    console.log('Template Action Ran')
  }
})