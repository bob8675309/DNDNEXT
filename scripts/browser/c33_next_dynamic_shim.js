// Standalone browser fixture only. Authentic NpcPanel & Sheet remain imported.
// Untested optional Next dynamic views must fail instead of falsely passing.
export default function dynamic(){
 return function OutOfScopeDynamicView(){
   throw Error("C3P excludes Next dynamic views; use actual Next route for merchant/craft");
 };
}
