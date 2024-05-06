#include <string.h>
#include <stdlib.h>
#include <time.h>
#include <stdio.h>
#include <stdarg.h>
#include <stdint.h>

int test_int = 123;
int *test_int_ptr = &test_int;

int call_callback(int (*fun)(int), int a){
	return fun(a);
}

int simple_func1(int a){
	return a+1;
}

float simple_func2(float a){
	return a+1;
}

double simple_func3(double a){
	return a+1;
}

int parse_int(char* str){
	return atoi(str);
}

char* int_to_string(int a){
	static char str[255];
	if(snprintf(str, sizeof(str), "%d", a) < 0){
		return NULL;
	}
	return str;
}

int test_sprintf(char *str, const char *format, ...){
	va_list argp;
	va_start(argp, format);
	int ret = vsprintf(str, format, argp);
	va_end(argp);
	return ret;
}

char* test_strcat(char* a, char* b){
	return strcat(a, b);
}

struct test{
	int a;
	char b;
	uint64_t c;
};

struct test return_struct_test(int a){
	struct test st;
	st.a = a;
	st.b = 'b';
	st.c = 123;
	return st;
}

char* sprint_struct_test(struct test* t){
	static char str[255];
	snprintf(str, 255, "a: %d, b: %u, c: %llu", t->a, t->b, t->c);
	return str;
}

struct test_handle_entry{
	int a;
};
struct test_handle{
	unsigned count;
	unsigned max;
	struct test_handle_entry* entry;
};
struct test_handle* open_test_handle(unsigned count){
	struct test_handle* th = malloc(sizeof(struct test_handle));
	th->count = 0;
	th->max = count;
	th->entry = NULL;
	return th;
}
void close_test_handle(struct test_handle* th){
	if(th->entry){
		free(th->entry);
		th->entry = NULL;
	}
	free(th);
}
struct test_handle_entry* get_next_entry(struct test_handle* th){
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

size_t sizeof_sllong(){
	return sizeof(long long);
}

size_t sizeof_slong(){
	return sizeof(long);
}

size_t sizeof_sint(){
	return sizeof(int);
}

size_t sizeof_sshort(){
	return sizeof(short);
}

size_t sizeof_schar(){
	return sizeof(char);
}

size_t sizeof_float(){
	return sizeof(float);
}

size_t sizeof_double(){
	return sizeof(double);
}

size_t sizeof_pointer(){
	return sizeof(void*);
}

size_t sizeof_size_t(){
	return sizeof(size_t);
}

size_t sizeof_ulong(){
	return sizeof(unsigned long);
}

size_t sizeof_ullong(){
	return sizeof(unsigned long long);
}
