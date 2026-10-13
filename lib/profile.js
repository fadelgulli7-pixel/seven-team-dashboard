'use strict';
function validPhoto(value){
  if(typeof value!=='string'||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value))return false;
  const bytes=Buffer.from(value.slice(23),'base64');
  return bytes.length>=4&&bytes.length<=100000&&bytes[0]===255&&bytes[1]===216&&bytes.at(-2)===255&&bytes.at(-1)===217;
}
module.exports={validPhoto};
