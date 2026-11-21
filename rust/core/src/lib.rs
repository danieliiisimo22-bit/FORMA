#![no_std]
#![cfg_attr(not(target_arch = "wasm32"), forbid(unsafe_code))]

/// Mixes one state of the Mulberry32 sequence into an unsigned 32-bit sample.
#[cfg_attr(target_arch = "wasm32", unsafe(no_mangle))]
pub extern "C" fn forma_random_word(state: u32) -> u32 {
    let mut word = (state ^ (state >> 15)).wrapping_mul(state | 1);
    word ^= word.wrapping_add((word ^ (word >> 7)).wrapping_mul(word | 61));
    word ^ (word >> 14)
}

#[cfg(target_arch = "wasm32")]
#[panic_handler]
fn panic(_: &core::panic::PanicInfo<'_>) -> ! {
    core::arch::wasm32::unreachable()
}

#[cfg(not(target_arch = "wasm32"))]
extern crate std;
