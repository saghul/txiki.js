setTimeout(() => {
    throw new Error('oops!');
}, 100);


setTimeout(() => {
    console.log('boooo!');
}, 99999);
