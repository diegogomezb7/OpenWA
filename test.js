const text = "Hola \\n mundo /n prueba";
const parsed = text.replace(/\\n/g, '\n').replace(/\/n/g, '\n');
console.log(parsed);
