const {sep}=require('path');

module.exports=Object.freeze({
  /**
   * Action Name Used In Commands.json
   */
  name: ''||require('path').basename(__filename).replace('.js',''),
  /**
   * Ran Async Function Upon Action Call
   */
  action: async function(cache) {
    let {
      start,
      end,
      index,
      tempKey,
      separator
    }=cache[cache.event? 'event':'cmd'].actions[cache.index].exclusives;
    if(!tempKey) {throw new Error('Requires tempKey');}
    const rawParams=cache.msg.content.split(separator? new RegExp(separator):new RegExp(cache.Config.bot.separator)).slice(cache.cmd.name.includes('_')? cache.cmd.name.match(/_/).length+1:1);
    if(rawParams.length==0){return this.setTempVar(tempKey,undefined,cache)}
    let res;
    if(index) {res=rawParams[index];};
    res=rawParams.slice(start||0,end||rawParams.length).reduce((prev,cur) => {return prev+(separator||cache.Config.bot.separator)+cur;});
    cache.temp[tempKey]=res;
  }
});