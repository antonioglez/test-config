const css = `
.red	{
  color: red
}
.green { 
  color: green
}
.blue	{
  color: blue
}
.yellow	{
  color: yellow
}
.cyan {
  color: cyan
}
.color008000 { 
  color: #008000 
}

.magenta	{
  color:rgba(255,0,255,1)
}
.white	{
  color: rgba(255,255,255,1)
}
.lime	{
  color:rgba(0,255,0,1)
}
.black{
  color: rgba(0,0,0,1)
}
.bg_cyan {
  color: rgba(0,255,255,1);
}
.bg_white	{
  color: rgba(255,255,255,1)
}
.bg_lime	{
  color:rgba(0,255,0,1)
}
.bg_cyan	{
  color:rgba(0,255,255,1)
}
.bg_red	{
  color:rgba(255,0,0,1)
}
.bg_yellow	{
  color:rgba(255,255,0,1)}

.bg_magenta	{
  color:rgba(255,0,255,1)
}
.bg_blue	{
  color:rgba(0,0,255,1)
}
.bg_black{
  color: rgba(0,0,0,1)
}
`;

const head = document.getElementsByTagName('head')?.[0];
const style = document.createElement('style');

style.textContent = css;
head.appendChild(style);
