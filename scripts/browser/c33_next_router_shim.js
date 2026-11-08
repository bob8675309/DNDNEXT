// Standalone browser fixture only; no real Next router/SSR needed.
const events={on(){},off(){},emit(){}};
export function useRouter(){
 return {pathname:"/town/[id]",route:"/town/[id]",asPath:"/town/fixture",
   query:{id:"fixture"},isReady:true,basePath:"",
   push:async()=>true,replace:async()=>true,prefetch:async()=>{},
   back(){},events};
}
export default {useRouter};
