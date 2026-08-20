import mongoose, {
  Document,
  Model,
  Schema,
} from 'mongoose';


export interface IAiMessage {
  role:
    | 'user'
    | 'assistant'
    | 'system';

  content: string;

  createdAt: Date;
}


export interface IAiSession
  extends Document {

  userId: string;

  guildId?: string;

  title?: string;

  messages: IAiMessage[];

  totalPromptTokens: number;

  totalCompletionTokens: number;

  totalTokens: number;

  totalRequests: number;

  createdAt: Date;

  updatedAt: Date;
}


const AiMessageSchema =
  new Schema<IAiMessage>(
    {
      role: {
        type: String,

        enum: [
          'user',
          'assistant',
          'system',
        ],

        required: true,
      },

      content: {
        type: String,

        required: true,
      },

      createdAt: {
        type: Date,

        default: Date.now,
      },
    },

    {
      _id: false,
    }
  );


const AiSessionSchema =
  new Schema<IAiSession>(
    {
      userId: {
        type: String,

        required: true,

        index: true,
      },

      guildId: {
        type: String,

        index: true,
      },

      title: {
        type: String,
      },

      messages: {
        type: [AiMessageSchema],

        default: [],
      },

      totalPromptTokens: {
        type: Number,

        default: 0,
      },

      totalCompletionTokens: {
        type: Number,

        default: 0,
      },

      totalTokens: {
        type: Number,

        default: 0,
      },

      totalRequests: {
        type: Number,

        default: 0,
      },
    },

    {
      timestamps: true,
    }
  );


AiSessionSchema.index(
  {
    userId: 1,

    guildId: 1,
  },

  {
    unique: true,
  }
);


const AiSession: Model<IAiSession> =
  mongoose.models.AiSession ||
  mongoose.model<IAiSession>(
    'AiSession',
    AiSessionSchema
  );


export default AiSession;