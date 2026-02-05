import assert from 'tjs:assert';

// ReadableStream as Response body consumed via text()
const chunks = [ 'part1', 'part2', 'part3' ];
let index = 0;

const stream = new ReadableStream({
    pull(controller) {
        if (index < chunks.length) {
            controller.enqueue(new TextEncoder().encode(chunks[index]));
            index++;
        } else {
            controller.close();
        }
    }
});

const response = new Response(stream);
const text = await response.text();

assert.eq(text, 'part1part2part3', 'ReadableStream body consumed correctly');
