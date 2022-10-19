#include <string.h>
#include <stdlib.h>
#include <time.h>

int test_int = 123;
int *test_int_ptr = &test_int;

int call_callback(int (*fun)(int), int a){
	return fun(a);
}
