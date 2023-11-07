async function foo() {
    throw new Error('oops!');
}


setTimeout(async () => {
    await foo();
}, 100);


setTimeout(() => {
    console.log('boooo!');
}, 99999);
