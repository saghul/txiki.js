import FFI from 'tjs:ffi';

let sopath = './build/libffi-test.so';
switch(navigator.userAgentData.platform){
	case 'Linux':
		sopath = './build/libffi-test.so';
		break;
	case 'macOS':
		sopath = './build/libffi-test.dylib';
		break;
	case 'Windows':
		sopath = './build/libffi-test.dll';
		break;
}

export { FFI, sopath };
