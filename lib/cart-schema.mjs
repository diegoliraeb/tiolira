import {z} from 'zod';
import {MAX_CART_QUANTITY} from './family-discount.mjs';
export const cartItemSchema=z.object({kind:z.enum(['product','collection']),id:z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),quantity:z.number().int().min(1).max(MAX_CART_QUANTITY).default(1)});
export const cartSchema=z.array(cartItemSchema).min(1).max(40);
