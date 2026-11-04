import {GroupInvitation} from "@/components/subscriptions/GroupInvitation";
export const dynamic="force-dynamic";
export default async function Page({params}:{params:Promise<{code:string}>}){const {code}=await params;return <GroupInvitation code={code}/>;}
