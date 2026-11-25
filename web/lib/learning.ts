import {z} from "zod";
const unit = z.object({read:z.boolean(),quiz:z.boolean(),practice:z.boolean(),draft:z.string().max(6000)}).strict();
export const documentSchema = z.object({
  role: z.object({pace:z.enum(["rapid","steady","deep"]),units:z.object(Object.fromEntries(["python","design","pytest","fixtures","cpp","component","mqtt","async","git","docker","ado","trace"].map(id=>[id,unit]))).strict(),story:z.string().max(6000),answers:z.array(z.string().max(6000)).length(12),ratings:z.array(z.number().int().min(0).max(3)).length(12)}).strict().optional(),
  days: z.array(z.number().int().positive()).max(10000).optional(),
  ...Object.fromEntries(['python','pytest','java'].flatMap(t => [0,1,2].map(i => [t+i, z.object({read:z.boolean().optional(),quiz:z.boolean().optional(),practice:z.boolean().optional(),draft:z.string().max(20000).optional()}).strict().optional()])))
}).strict();
