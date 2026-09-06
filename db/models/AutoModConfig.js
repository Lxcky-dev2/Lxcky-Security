"use strict";
const mongoose=require('mongoose');
const AutoModConfigSchema=new mongoose.Schema({
  guildId:{type:String,required:true,unique:true},
  enabled:{type:Boolean,default:false},
  spam:{type:Boolean,default:false},
  invites:{type:Boolean,default:false},
  mentions:{type:Boolean,default:false},
  caps:{type:Boolean,default:false},
  words:{type:Boolean,default:false},
  regex:{type:Boolean,default:false},
  blockedWords:{type:[String],default:[]},
  regexRules:{type:[String],default:[]},
  maxMentions:{type:Number,default:8},
  capsPercent:{type:Number,default:80},
  punishment:{type:String,enum:['delete','warn','timeout'],default:'delete'},
  timeoutMinutes:{type:Number,default:5},
  logChannelId:{type:String,default:null},
  bypassRoleIds:{type:[String],default:[]},
  bypassChannelIds:{type:[String],default:[]},
  updatedAt:{type:Date,default:Date.now}
},{minimize:false});
AutoModConfigSchema.pre('save',function(next){this.updatedAt=new Date();next();});
module.exports=mongoose.model('AutoModConfig',AutoModConfigSchema);
