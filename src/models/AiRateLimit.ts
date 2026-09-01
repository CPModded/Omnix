import mongoose, { Schema, Document } from 'mongoose';
export interface IAiRateLimit extends Document { key: string; windowStartedAt: Date; count: number; }
const schema = new Schema<IAiRateLimit>({ key:{type:String,unique:true,index:true}, windowStartedAt:{type:Date,required:true}, count:{type:Number,default:0} }, { timestamps:true });
export default (mongoose.models.AiRateLimit || mongoose.model<IAiRateLimit>('AiRateLimit', schema));
