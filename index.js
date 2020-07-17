/**
 * Official Discord Bot Framework Of **StatonFoundation™**
 * @author Dyontai Staton
 */
const DiscordBase={};
var djs=DiscordBase.djs=require('discord.js');
var console=require('./util/rareConsole');

const files=DiscordBase.files={};
files.fs=require('fs');
files.path=require('path');
files.fstorm=require('fstorm');
files.writers={};
files.data={};
files.saveData=(file,callback=() => {}) => {
  let writer=this.writers[file];
  if(!writer) {writer=this.fstorm(this.path.join(process.cwd(),'data',`${file}.json`));}
  writer.write(JSON.stringify(this.data[file]),callback.bind(this));
};
files.formatDirJSON=async (dirPath) => {
  const {fs,path}=files;
  const dir=await fs.promises.opendir(dirPath);
  const formattedDir={};
  for await(const dirent of dir) {
    if(path.extname(dirent.name)!='.json') {continue;}
    let content=await fs.promises.readFile(path.join(dirPath,dirent.name));
    formattedDir[path.basename(dirent.name,'.json')]=JSON.parse(content);
  }
  return formattedDir;
};
files.formatData=async function() {
  this.data=await this.formatDirJSON(this.path.join(__dirname,'data'));
};
files.init=async function() {
  return await this.formatData();
};

var config=DiscordBase.config={};
config.init=async function() {
  return await this.format();
};
config.format=async function() {
  const {formatDirJSON,path}=files;
  config={...this,...(await formatDirJSON(path.join(__dirname,'config')))};
};

const bot=DiscordBase.bot={};
bot.client=null;
bot.cmds={};

bot.init=async function() {
  await files.init();
  this.initClient();
  await this.setup();
  this.formatCommands();
  await actions.init();
};
bot.initClient=function() {
  return this.client=new djs.Client();
};
bot.initEvent=function() {
  this.client.on('ready',this.onReady.bind(this));
  this.client.on('message',this.onMessage.bind(this));
};
bot.setup=async function() {
  await config.init();
  await this.login();
  this.initEvent();
};
bot.checkTag=(content) => {
  const {tag,separator}=config.bot;
  content=content.split(new RegExp(separator))[0];
  if(!content.startsWith(tag)) {return;}
  return content.substring(tag.length);
};
bot.formatCommands=function() {
  for(cmd of config.commands) {
    this.cmds[cmd.name]=cmd;
    if(cmd.aliases) {
      for(alias of aliases) {
        this.cmds[alias]=cmd;
      }
    }
  }
};
bot.checkCommand=function(msg) {
  let command=this.checkTag(msg.content);
  if(!command) {return;}
  const cmd=this.cmds[command];
  if(cmd) {
    actions.preform(msg,cmd);
    return cmd;
  }
};
bot.onReady=() => {
  console.log();
};
bot.onMessage=function(msg) {
  if(msg.author.bot) {return;}
  let cmd;
  try {
    cmd=this.checkCommand(msg);
  }
  catch(e) {
    console.log(e);
  }
};
bot.login=async function() {
  await this.client.login(config.bot.token);
  console.log('Bot Logged In');
};

let actions=DiscordBase.actions={};
actions.getDiscordBase=() => {return DiscordBase;};
actions.init=async function() {
  const {fs,path}=files;
  const dir='actions';
  await fs.readdirSync(path.join(__dirname,dir)).forEach(function(file) {
    if(path.extname(file)=='.js') {
      const action=require(require('path').join(__dirname,dir,file));
      if(!action.action) {return;}
      this[action.name]=action.action;
    }
  }.bind(this));
};
actions.eval=function(content,cache) {
  if(!content) {return;}
  if(!cache) {return;}
  const {msg,member,guild,loadingMsg,temp}=cache;
  const DiscordBase=this.getDiscordBase();
  const globalVars=files.data.global;
  const guildVars=files.data.guilds[guild.id];
  const userVars=files.data.users[member.id];
  try {eval(content);}
  catch(e) {return console.error(e);}
};
actions.evalMessage=function(content,cache) {
  if(!content) return '';
  if(!content.match(/\$\{.*\}/im)) return content;
  return this.eval('`'+content.replace(/`/g,'\\`')+'`',cache);
};
actions.checkPermission=(msg,permission) => {
  const member=msg.member;
  if(!member) return false;
  if(!permission) return true;
  if(permission==='NONE') return true;
  if(msg.guild.owner===member) return true;
  return member.permissions.has([permission]);
};
actions.checkRole=(msg,role) => {
  const member=msg.member;
  if(!member) return false;
  if(!role) return true;
  if(role==='NONE') return true;
  return member.roles.has(role);
};
actions.checkConditions=function(msg,cmd) {
  const isGuild=Boolean(msg.guild&&msg.member);
  const restriction=parseInt(cmd.restriction);
  const {role,permission}=cmd;
  const isPassing=() => {
    switch(restriction) {
      case 0: return isGuild; // Called Within A Guild
      case 1: return isGuild&&msg.guild.owner===msg.member; // Called By Owner Of The Called Guild
      case 2: return files.data.bot.ownerId&&files.data.bot.ownerId==msg.author.id; // Called By Owner Of The Bot
      case 3: return !isGuild; // Called Outside A Guild
      default: return true;
    }
  };
  return Boolean(this.checkRole(msg,role)&&this.checkPermission(msg,permission)&&isPassing());
};
actions.preform=function(msg,cmd) {
  if(!this.checkConditions(msg,cmd)) {return;}
  this.invoke(msg,cmd);
};
actions.invoke=async function(msg,cmd) {
  const {actions}=cmd;
  if(!actions[0]) {return;}
  const cache={
    cmd,
    index: 0,
    temp: {},
    guild: msg.guild,
    msg,
    client: bot.client,
    resMsg: null,
    closeAction: function(callback=() => {}) {
      actions.slice(0,cache.id);
      bot.displayFailed(this);
      callback.bind(this)();
    }
  };
  await this.displayLoading(cache);
  for(let i=0;i<actions.length;i++) {
    const action=actions[i];
    try {
      await this[action.name](cache);
      cache.index+=1;
    }
    catch(e) {
      this.displayError(cache,e);
      console.log(e);
      break;
    }
  }
  await this.displayCompleted(cache);
};
actions.displayError=async (cache,e) => {
  if(!cache.cmd.debug) {return;}
  const errorEmbed={...config.bot.errorMsg.embed,description: e.message};
  let errorMsg={...config.bot.errorMsg,embed: errorEmbed};
  if(!cache.resMsg) {return await cache.msg.send(errorMsg);}
  cache.completed=true;
  return await cache.resMsg.edit(errorMsg);
};
actions.displayLoading=async (cache) => {
  if(!cache.cmd.lifecycle.loading) {return;}
  return cache.resMsg=await cache.msg.channel.send(config.bot.loadingMsg);
};
actions.displayCompleted=async (cache) => {
  if(!cache.resMsg) {return;}
  if(!cache.cmd.lifecycle.completed) {return;}
  if(cache.completed) {return;}
  return await cache.resMsg.edit(config.bot.completedMsg);
};
actions.displayFailed=async (cache) => {
  if(!cache.resMsg) {return; }
  cache.completed=true;
  return await cache.resMsg.edit(config.bot.failedMsg);
};

bot.init();