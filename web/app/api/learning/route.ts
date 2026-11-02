import { NextRequest, NextResponse } from "next/server";
import { owner, apiError, readJSON } from "@/lib/server";
import { z } from "zod";
const documentSchema = z.object({
  days: z.array(z.number().int().positive()).max(10000).optional(),
  ...Object.fromEntries(['python','pytest','java'].flatMap(t => [0,1,2].map(i => [t+i, z.object({read:z.boolean().optional(),quiz:z.boolean().optional(),practice:z.boolean().optional(),draft:z.string().max(20000).optional()}).strict().optional()])))
}).strict();
export async function GET(req: NextRequest) {
  try {
    const {db,user} = await owner(req);
    const {data,error} = await db.from('learning_progress').select('document,revision').eq('owner_id',user.id).maybeSingle();
    if(error) throw error;
    return NextResponse.json(data, {headers:{'Cache-Control':'no-store'}});
  } catch(e) { return apiError(e); }
}
export async function POST(req: NextRequest) {
  try {
    const {db,user} = await owner(req);
    const parsed = z.object({document:documentSchema,revision:z.number().int().nonnegative()}).safeParse(await readJSON(req));
    if(!parsed.success) return NextResponse.json({error:'Invalid learning data.'},{status:400});
    const {document,revision} = parsed.data;
    const query = revision === 0 ? db.from('learning_progress').insert({owner_id:user.id,document,revision:1}) : db.from('learning_progress').update({document,revision:revision+1}).eq('owner_id',user.id).eq('revision',revision);
    const {data,error} = await query.select('revision').maybeSingle();
    if(error?.code === '23505' || (!error && !data)) return NextResponse.json({error:'Progress changed on another device. Load online progress before saving again.'},{status:409});
    if(error) throw error;
    return NextResponse.json(data);
  } catch(e) {
    if(e instanceof SyntaxError || (e instanceof Error && e.message === 'SIZE')) return NextResponse.json({error:'Invalid or oversized learning data.'},{status:400});
    return apiError(e);
  }
}
