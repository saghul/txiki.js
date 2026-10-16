Date += Date;

async function f() {
    throw new Error('date-overwritten');
}

f();
