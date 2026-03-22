const f = require('fs').readFileSync('C:/projects/signova/src/pages/Landing.jsx','utf8').split('\n')
for(let i=593;i<=625;i++) console.log((i+1)+': '+f[i])
