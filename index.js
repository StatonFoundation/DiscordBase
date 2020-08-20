/**
 * Official Discord Bot Framework Of **StatonFoundation™**
 * @author Dyontai Staton
 */
const DiscordBase={};
var djs=DiscordBase.djs=require('discord.js');
var console=require('./util/rareConsole');

const Files=DiscordBase.Files={};
Files.fs=require('fs');
Files.path=require('path');
Files.fstorm=require('fstorm');
Files.writers={};
Files.data={};
Files.saveData=(file,callback=() => {}) => {
  let writer=this.writers[file];
  if(!writer) {writer=this.fstorm(this.path.join(process.cwd(),'data',`${file}.json`));}
  writer.write(JSON.stringify(this.data[file]),callback.bind(this));
};
Files.formatDirJSON=async (dirPath) => {
  const {fs,path}=Files;
  const dir=await fs.promises.opendir(dirPath);
  const formattedDir={};
  for await(const dirent of dir) {
    if(path.extname(dirent.name)!='.json') {continue;}
    let content=await fs.promises.readFile(path.join(dirPath,dirent.name));
    formattedDir[path.basename(dirent.name,'.json')]=JSON.parse(content);
  }
  return formattedDir;
};
Files.formatData=async function() {
  this.data=await this.formatDirJSON(this.path.join(__dirname,'data'));
};
Files.init=async function() {
  return await this.formatData();
};

let Config=DiscordBase.Config={};
Config.init=async function() {
  return await this.format();
};
Config.format=async function() {
  const {formatDirJSON,path}=Files;
  Config={...this,...(await formatDirJSON(path.join(__dirname,'config')))};
};

const Bot=DiscordBase.Bot={};
Bot.client=null;
Bot.cmds={};

Bot.init=async function() {
  await Files.init();
  this.initClient();
  await this.setup();
  this.formatCommands();
  await Actions.init();
  await Events.init();
  await this.login();
};
Bot.initClient=function() {
  return this.client=new djs.Client();
};
Bot.initEvent=function() {
  this.client.on('ready',this.onReady.bind(this));
  this.client.on('message',this.onMessage.bind(this));
};
Bot.setup=async function() {
  await Config.init();
  this.initEvent();
};
Bot.checkTag=(content) => {
  const {tag,separator}=Config.bot;
  content=content.split(new RegExp(separator));
  if(!content[0].startsWith(tag)) {return;}
  return [content[0].substring(tag.length),...content.slice(1)];
};
Bot.formatCommands=function() {
  const parseCommand=(cmd) => {
    cmd.name=cmd.name.toUpperCase();
    this.cmds[cmd.name]={...cmd,original: true};
    if(cmd.aliases) {
      for(alias of cmd.aliases) {
        this.cmds[alias.toUpperCase()]={...cmd,aliases: false};
      }
    }
    if(cmd.extras) {
      for(extra of cmd.extras) {
        parseCommand({
          ...extra,
          name: `${cmd.name}_${extra.name}`,
          ...extra.aliases&&{aliases: extra.aliases.map(alias => `${cmd.name}_${alias}`)}
        });
      }
    }
  };
  for(cmd of Config.commands) {
    parseCommand(cmd);
  }
};
Bot.checkCommand=function(msg) {
  let command=this.checkTag(msg.content); // Returns Split Discord Message By Tag
  if(!command) {return;}
  cmdName=command.reduce((prev,cur,i) => {
    let prevCmd=this.cmds[prev.toUpperCase()];
    let combinedCmdName=`${prevCmd.name}_${cur}`.toUpperCase();
    let curCmd=prevCmd&&this.cmds[combinedCmdName];
    if(curCmd) {return combinedCmdName;}
    return prevCmd.name.toUpperCase();
  });
  const cmd=this.cmds[cmdName.toUpperCase()];
  if(!cmd) {return;}
  Actions.preform(msg,cmd);
  return cmd;
};
Bot.onReady=() => {
  console.log();
};
Bot.onMessage=function(msg) {
  if(msg.author.bot) {return;}
  try {
    this.checkCommand(msg);
  }
  catch(e) {
    console.log(e);
  }
};
Bot.login=async function() {
  await this.client.login(process.env.BOT_TOKEN||Config.bot.token);
  console.log(console.chalk.blue.bold.underline("Bot Ready"));
};

let Actions=DiscordBase.Actions={};
Actions.getDiscordBase=() => {return DiscordBase;};
Actions.init=async function() {
  const {fs,path}=Files;
  const dir='actions';
  await fs.readdirSync(path.join(__dirname,dir)).forEach((file) => {
    if(path.extname(file)=='.js') {
      const action=require(require('path').join(__dirname,dir,file));
      if(!action.action) {return;}
      this[action.name.toLowerCase()]=action.action.bind(this);
    }
  });
};
Actions.eval=function(content,cache) {
  if(!content) {return;}
  if(!cache) {return;}
  const {msg,member,guild,temp}=cache;
  const DiscordBase=this.getDiscordBase();
  const globalVars=Files.data.global;
  const guildVars=Files.data.guilds[guild.id];
  const userVars=Files.data.users[member.id];
  try {eval(content);}
  catch(e) {return console.error(e);}
};
Actions.evalMessage=function(content,cache) {
  if(!content) return '';
  if(!content.match(/\$\{.*\}/im)) return content;
  return this.eval('`'+content.replace(/`/g,'\\`')+'`',cache);
};
Actions.checkPermission=(msg,permission) => {
  const member=msg.member;
  if(!member) return false;
  if(!permission) return true;
  if(permission==='NONE') return true;
  if(msg.guild.owner===member) return true;
  return member.permissions.has([permission]);
};
Actions.checkRole=(msg,role) => {
  const member=msg.member;
  if(!member) return false;
  if(!role) return true;
  if(role==='NONE') return true;
  return member.roles.has(role);
};
Actions.checkConditions=function(msg,cmd) {
  const isGuild=Boolean(msg.guild&&msg.member);
  const restriction=parseInt(cmd.restriction)||0;
  const {role,permission}=cmd;
  const isPassing=() => {
    switch(restriction) {
      case 0: return isGuild; // Called Within A Guild
      case 1: return isGuild&&msg.guild.owner===msg.member; // Called By Owner Of The Called Guild
      case 2: return Files.data.bot.ownerId&&Files.data.bot.ownerId==msg.author.id; // Called By Owner Of The Bot
      case 3: return !isGuild; // Called Outside A Guild
      default: return true;
    }
  };
  return Boolean(this.checkRole(msg,role)&&this.checkPermission(msg,permission)&&isPassing());
};
Actions.setTempVar=function(key,value,cache){
  cache[key]=value;
}
Actions.preform=function(msg,cmd) {
  if(!this.checkConditions(msg,cmd)) {return;}
  this.invoke(msg,cmd);
};
Actions.invoke=async function(msg,cmd) {
  const {actions}=cmd;
  if(!actions||!actions[0]) {return console.log(new Error(`Command ${cmd.name} Has No Actions To Run`));}
  const cache={
    cmd,
    index: 0,
    temp: {},
    guild: msg.guild,
    msg,
    client: Bot.client,
    Config,
    resMsg: null,
    closeAction: function(callback=() => {}) {
      actions.slice(0,actions.length);
      Bot.displayFailed(this);
      callback.bind(this)();
    }
  };
  cmd.lifecycle=cmd.lifecycle||{
    remove: false,
    loading: true,
    completed: true
  };
  if(cmd.lifecycle.remove) {await msg.delete();}
  if(cmd.lifecycle.loading) {await this.displayLoading(cache);}
  for(let i=0;i<actions.length;i++) {
    const action=actions[i];
    try {
      await this[action.name.toLowerCase()](cache);
      cache.index+=1;
    }
    catch(e) {
      if(true) {this.displayError(cache,e);}
      console.log(e);
      break;
    }
  }
  if(cmd.lifecycle.completed) {await this.displayCompleted(cache);}
};
Actions.displayError=async (cache,e) => {
  const errorEmbed={...Config.bot.errorMsg.embed,description: e.message,...e.embed&&e.embed};
  let errorMsg={...Config.bot.errorMsg,embed: errorEmbed};
  if(!cache.resMsg) {return await cache.msg.send(errorMsg);}
  cache.completed=true;
  return await cache.resMsg.edit(errorMsg);
};
Actions.displayLoading=async (cache) => {
  if(!cache.cmd.lifecycle.loading) {return;}
  return cache.resMsg=await cache.msg.channel.send(Config.bot.loadingMsg);
};
Actions.displayCompleted=async (cache) => {
  if(!cache.resMsg) {return;}
  if(!cache.cmd.lifecycle.completed) {return;}
  if(cache.completed) {return;}
  return await cache.resMsg.edit(Config.bot.completedMsg);
};
Actions.displayFailed=async (cache) => {
  if(!cache.resMsg) {return;}
  cache.completed=true;
  return await cache.resMsg.edit(Config.bot.failedMsg);
};

let Events=DiscordBase.Events={};
Events.init=function() {
  const {events}=Config.events;
  for(eventKey in events) {
    let event=events[eventKey];
    Bot.client.on(eventKey,async function({...res}) {
      await this.invoke({...event,args: {...res}});
    }.bind(this));
  }
};
Events.invoke=async function(event) {
  const {actions}=event;
  if(!actions&&!actions[0]) {return console.log(new Error(`Event ${event.name} Has No Actions To Run`));};
  const cache={
    event,
    index: 0,
    temp: {},
    Config,
    client: Bot.client,
    closeAction: function(callback=() => {}) {
      actions.slice(0,actions.length);
      bot.displayFailed(this);
      callback.bind(this)();
    }
  };
  for(let i=0;i<actions.length;i++) {
    const action=actions[i];
    try {
      await Actions[action.name](cache);
      cache.index+=1;
    }
    catch(e) {
      console.log(e);
      break;
    }
  }
};

Bot.init();