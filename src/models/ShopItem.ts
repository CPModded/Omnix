/**
 * ====================================================================
 * SCHÉMA DE LA BOUTIQUE VIRTUELLE (OMNIX ECONOMY CORE)
 * Stocke les articles et rôles achetables de manière étanche par serveur.
 * ====================================================================
 */

import { Schema, model, Document } from 'mongoose';

export interface IShopItem extends Document {
  guildId: string;
  itemId: string; // Identifiant unique court (ex: SH-A3F1)
  name: string;
  price: number;
  roleId: string | null; // ID du rôle Discord à attribuer à l'achat
  description: string | null;
  createdAt: Date;
}

const ShopItemSchema = new Schema<IShopItem>({
  guildId: { type: String, required: true, index: true },
  itemId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  price: { type: Number, required: true, min: 1 },
  roleId: { type: String, default: null },
  description: { type: String, default: "Aucune description fournie." }
}, { timestamps: { createdAt: true, updatedAt: false } });

// Un identifiant d'article doit être unique sur un même serveur
ShopItemSchema.index({ guildId: 1, itemId: 1 }, { unique: true });

export const ShopItem = model<IShopItem>('ShopItem', ShopItemSchema);