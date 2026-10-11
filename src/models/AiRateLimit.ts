import mongoose, { Schema, Document, Model } from 'mongoose';
export interface IAiRateLimit extends Document { key: string; windowStartedAt: Date; count: number; }
const schema = new Schema<IAiRateLimit>({ key:{type:String,unique:true,index:true}, windowStartedAt:{type:Date,required:true}, count:{type:Number,default:0} }, { timestamps:true });
const AiRateLimit: Model<IAiRateLimit> = (mongoose.models.AiRateLimit as Model<IAiRateLimit> | undefined) || mongoose.model<IAiRateLimit>('AiRateLimit', schema);
export default AiRateLimit;
