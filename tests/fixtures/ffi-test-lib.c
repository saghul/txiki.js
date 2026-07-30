#include <inttypes.h>
#include <stddef.h>
#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdint.h>

#ifdef _WIN32
#define FFI_TEST_EXPORT __declspec(dllexport)
#else
#define FFI_TEST_EXPORT
#endif

FFI_TEST_EXPORT int test_int = 123;
FFI_TEST_EXPORT int *test_int_ptr = &test_int;

FFI_TEST_EXPORT int call_callback(int (*fun)(int), int a){
	return fun(a);
}

FFI_TEST_EXPORT int simple_func1(int a){
	return a+1;
}

FFI_TEST_EXPORT float simple_func2(float a){
	return a+1;
}

FFI_TEST_EXPORT double simple_func3(double a){
	return a+1;
}

FFI_TEST_EXPORT int parse_int(char* str){
	return atoi(str);
}

FFI_TEST_EXPORT char* int_to_string(int a){
	static char str[255];
	if(snprintf(str, sizeof(str), "%d", a) < 0){
		return NULL;
	}
	return str;
}

FFI_TEST_EXPORT int test_sprintf(char *str, const char *format, ...){
	va_list argp;
	va_start(argp, format);
	int ret = vsprintf(str, format, argp);
	va_end(argp);
	return ret;
}

FFI_TEST_EXPORT char* test_strcat(char* a, char* b){
	return strcat(a, b);
}

struct test{
	int a;
	char b;
	uint64_t c;
};

FFI_TEST_EXPORT struct test return_struct_test(int a){
	struct test st;
	st.a = a;
	st.b = 'b';
	st.c = 123;
	return st;
}

FFI_TEST_EXPORT char* sprint_struct_test(struct test* t){
	static char str[255];
	snprintf(str, 255, "a: %d, b: %u, c: %" PRIu64, t->a, t->b, t->c);
	return str;
}

FFI_TEST_EXPORT char* sprint_struct_byval_test(struct test t){
	static char str[255];
	snprintf(str, 255, "a: %d, b: %u, c: %" PRIu64, t.a, t.b, t.c);
	return str;
}

FFI_TEST_EXPORT size_t sizeof_struct_test(){
	return sizeof(struct test);
}

FFI_TEST_EXPORT size_t offsetof_struct_test_b(){
	return offsetof(struct test, b);
}

FFI_TEST_EXPORT size_t offsetof_struct_test_c(){
	return offsetof(struct test, c);
}

struct str_test{
	char* s;
	int n;
};

FFI_TEST_EXPORT char* sprint_str_test(struct str_test* t){
	static char str[255];
	snprintf(str, 255, "%s:%d", t->s ? t->s : "(null)", t->n);
	return str;
}

/* The `{ T* data; size_t len }` shape: a pointer to a run of elements plus its
 * count, which is what defineStruct's [ elementType ] fields pack into. */
struct byte_span{
	unsigned char* data;
	size_t len;
};

FFI_TEST_EXPORT unsigned sum_byte_span(struct byte_span* s){
	unsigned total = 0;
	for(size_t i = 0; i < s->len; i++){
		total += s->data[i];
	}
	return total;
}

struct point{
	float x;
	float y;
};

struct polyline{
	struct point* points;
	unsigned count;
};

FFI_TEST_EXPORT float sum_polyline(struct polyline* p){
	float total = 0;
	for(unsigned i = 0; i < p->count; i++){
		total += p->points[i].x + p->points[i].y;
	}
	return total;
}

/* Fills in a struct the caller allocated: `items` points at `count` ints. */
struct int_list{
	unsigned count;
	int* items;
};

FFI_TEST_EXPORT void fill_int_list(struct int_list* l){
	for(unsigned i = 0; i < l->count; i++){
		l->items[i] = (int)(i + 1) * 10;
	}
}

/* Arrays laid out inside the struct, as opposed to a pointer to elements. */
struct grid{
	char name[8];
	int cells[4];
};

FFI_TEST_EXPORT size_t sizeof_struct_grid(){
	return sizeof(struct grid);
}

FFI_TEST_EXPORT size_t offsetof_struct_grid_cells(){
	return offsetof(struct grid, cells);
}

FFI_TEST_EXPORT char* sprint_grid(struct grid* g){
	static char str[255];
	snprintf(str, 255, "%s:%d,%d,%d,%d", g->name, g->cells[0], g->cells[1], g->cells[2], g->cells[3]);
	return str;
}

/* A nested struct reached through a pointer rather than laid out inline. */
struct limits{
	uint32_t min_size;
	uint32_t max_size;
};

struct device_desc{
	uint32_t id;
	struct limits* limits;
};

FFI_TEST_EXPORT int device_desc_span(struct device_desc* d){
	if(!d->limits){
		return -1;
	}
	return (int)(d->limits->max_size - d->limits->min_size);
}

FFI_TEST_EXPORT void set_device_limits(struct device_desc* d, uint32_t min_size, uint32_t max_size){
	d->limits->min_size = min_size;
	d->limits->max_size = max_size;
}

struct test_handle_entry{
	int a;
};
struct test_handle{
	unsigned count;
	unsigned max;
	struct test_handle_entry* entry;
};
FFI_TEST_EXPORT struct test_handle* open_test_handle(unsigned count){
	struct test_handle* th = malloc(sizeof(struct test_handle));
	th->count = 0;
	th->max = count;
	th->entry = NULL;
	return th;
}
FFI_TEST_EXPORT void close_test_handle(struct test_handle* th){
	if(th->entry){
		free(th->entry);
		th->entry = NULL;
	}
	free(th);
}
FFI_TEST_EXPORT struct test_handle_entry* get_next_entry(struct test_handle* th){
	if(th->entry){
		free(th->entry);
		th->entry = NULL;
	}
	if(th->count < th->max){
		th->count++;
		th->entry = malloc(sizeof(struct test_handle_entry));
		th->entry->a = th->count;
	}
	return th->entry;
}

FFI_TEST_EXPORT size_t sizeof_sllong(){
	return sizeof(long long);
}

FFI_TEST_EXPORT size_t sizeof_slong(){
	return sizeof(long);
}

FFI_TEST_EXPORT size_t sizeof_sint(){
	return sizeof(int);
}

FFI_TEST_EXPORT size_t sizeof_sshort(){
	return sizeof(short);
}

FFI_TEST_EXPORT size_t sizeof_schar(){
	return sizeof(char);
}

FFI_TEST_EXPORT size_t sizeof_float(){
	return sizeof(float);
}

FFI_TEST_EXPORT size_t sizeof_double(){
	return sizeof(double);
}

FFI_TEST_EXPORT size_t sizeof_pointer(){
	return sizeof(void*);
}

FFI_TEST_EXPORT size_t sizeof_size_t(){
	return sizeof(size_t);
}

FFI_TEST_EXPORT size_t sizeof_ulong(){
	return sizeof(unsigned long);
}

FFI_TEST_EXPORT size_t sizeof_ullong(){
	return sizeof(unsigned long long);
}
