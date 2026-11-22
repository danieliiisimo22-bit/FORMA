#![forbid(unsafe_code)]

pub mod color;
pub mod generator;
pub mod math;
pub mod recipe;
pub mod render;
pub mod studio;

/// Mixes one state of the Mulberry32 sequence into an unsigned sample.
pub fn forma_random_word(state: u32) -> u32 {
    let mut word = (state ^ (state >> 15)).wrapping_mul(state | 1);
    word ^= word.wrapping_add((word ^ (word >> 7)).wrapping_mul(word | 61));
    word ^ (word >> 14)
}
