use forma_core::color::{HARMONIES, PERSONALITIES, build_ramp, generate_colors, valid_hex};
use forma_core::generator::GENERATORS;
use forma_core::math::random_from;
use forma_core::recipe::Recipe;
use forma_core::render::{Scene, Tile, fold, resolution, validate_size};
use forma_core::studio::Studio;
use serde::Deserialize;
use std::collections::HashSet;

#[derive(Deserialize)]
struct Reference {
    recipe: Recipe,
    pixels: String,
}

#[test]
fn recipes_and_pixels_match_the_published_typescript_engine() {
    let cases: Vec<Reference> = serde_json::from_str(include_str!("data/reference.json")).unwrap();
    assert_eq!(cases.len(), GENERATORS.len() * 3);
    for (generator, cases) in GENERATORS.iter().zip(cases.chunks_exact(3)) {
        let preset = Recipe::preset(generator);
        assert_eq!(preset, cases[0].recipe);
        let children = preset.mutate(123456789, 2);
        assert_eq!(children, [cases[1].recipe.clone(), cases[2].recipe.clone()]);
    }
    for case in cases {
        case.recipe.validate().unwrap();
        let pixels = Scene::new(&case.recipe).cpu_pixels(Tile::full(31, 19));
        assert_eq!(pixels.len() * 2, case.pixels.len());
        for (index, pixel) in pixels.into_iter().enumerate() {
            let old = u8::from_str_radix(&case.pixels[index * 2..index * 2 + 2], 16).unwrap();
            assert!(
                pixel.abs_diff(old) <= 1,
                "{} seed {} pixel {index}: {pixel} vs {old}",
                case.recipe.generator,
                case.recipe.seed
            );
        }
    }
}

#[test]
fn all_generators_respond_to_seeds_and_keep_a_visible_color_distribution() {
    let tile = Tile::full(61, 43);
    for generator in GENERATORS {
        let recipe = Recipe::preset(generator);
        let image = Scene::new(&recipe).cpu_pixels(tile);
        let other =
            Scene::new(&recipe.variant(recipe.seed.wrapping_add(35611), 0.13)).cpu_pixels(tile);
        let colors: HashSet<_> = image.chunks_exact(4).collect();
        let distance: usize = image
            .iter()
            .zip(other)
            .map(|(a, b)| a.abs_diff(b) as usize)
            .sum();
        assert!(
            colors.len() > 20 && distance > (tile.width * tile.height * 6) as usize,
            "{}",
            generator.id
        );
    }
}

#[test]
fn locks_survive_variants_and_colors_match_the_palette() {
    let mut recipe = Recipe::preset(&GENERATORS[0]);
    assert_eq!(&build_ramp(&recipe.palette, 1.0)[..3], &[20, 12, 24]);
    let mut palette_results = HashSet::new();
    for p in PERSONALITIES {
        let colors = generate_colors(&recipe.palette, p.id, "analog", 33862, &[1, 4]);
        assert_eq!(colors[1], recipe.palette[1]);
        assert_eq!(colors[4], recipe.palette[4]);
        assert!(colors.iter().all(|hex| valid_hex(hex)));
        assert!(palette_results.insert(colors));
    }
    palette_results.clear();
    for (harmony, _, _) in HARMONIES {
        assert!(palette_results.insert(generate_colors(&recipe.palette, "Bold", harmony, 15, &[])));
    }
    recipe.palette_locked = true;
    recipe.parameter_locks = vec![0, 2];
    let variants = recipe.mutate(9384567, 16);
    assert_eq!(variants, recipe.mutate(9384567, 16));
    assert_eq!(
        variants
            .iter()
            .map(|r| r.seed)
            .collect::<HashSet<_>>()
            .len(),
        16
    );
    for child in variants {
        assert_eq!(child.palette, recipe.palette);
        assert_eq!(child.parameters[0], recipe.parameters[0]);
        assert_eq!(child.parameters[2], recipe.parameters[2]);
    }
    assert_eq!(recipe.surprise(777).palette, recipe.palette);
}

#[test]
fn preserves_symmetry_and_export_limits_and_rejects_incompatible_recipes() {
    let mut r = Recipe::preset(&GENERATORS[0]);
    r.symmetry.mode = "mirror".into();
    assert_eq!(fold(1.0, 0.5, &r.symmetry), fold(-1.0, 0.5, &r.symmetry));
    r.symmetry.mode = "horizontal".into();
    assert_eq!(fold(1.0, 0.5, &r.symmetry), fold(1.0, -0.5, &r.symmetry));
    r.aspect = "16:9".into();
    assert_eq!(resolution(&r, 1080), [1920, 1080]);
    assert_eq!(resolution(&r, 4320), [7680, 4320]);
    r.aspect = "9:16".into();
    assert_eq!(resolution(&r, 1440), [1440, 2560]);
    r.aspect = "21:9".into();
    let [width, height] = resolution(&r, 4320);
    assert!(validate_size(width, height).is_ok());
    assert!(validate_size(8192, 8192).is_err());
    assert!(validate_size(0, 800).is_err());
    r.validate().unwrap();
    let mut invalid = r.clone();
    invalid.custom_aspect = [100, 1];
    assert!(invalid.validate().is_err());
    r.algorithm = 2;
    assert!(r.validate().is_err());
}

#[test]
fn seeds_and_tiled_rendering_are_stable() {
    assert_eq!(
        (0..3)
            .scan(random_from(482901), |rng, _| Some(
                (rng() * 4_294_967_296.0) as u32
            ))
            .collect::<Vec<_>>(),
        [3379038118, 2876805299, 388268013]
    );
    let recipe = Recipe::preset(&GENERATORS[0]);
    let scene = Scene::new(&recipe);
    let full = scene.cpu_pixels(Tile::full(51, 37));
    let tile = scene.cpu_pixels(Tile {
        width: 13,
        height: 11,
        x: 8,
        y: 9,
        full_width: 51,
        full_height: 37,
    });
    for (row, chunk) in tile.chunks_exact(13 * 4).enumerate() {
        let start = ((row + 9) * 51 + 8) * 4;
        assert_eq!(chunk, &full[start..start + 13 * 4]);
    }
}

#[test]
fn history_and_library_survive_original_session_format() {
    let mut studio = Studio::default();
    for seed in 1..=5 {
        studio.apply(studio.recipe().variant(seed, 0.10));
    }
    studio.save_recipe("Una forma").unwrap();
    studio.favorite(studio.recipe().clone());
    studio.undo();
    assert_eq!(studio.recipe().seed, 4);
    studio.redo();
    let session = serde_json::to_string(&studio.session).unwrap();
    let restored = Studio::restore(&session).unwrap();
    assert_eq!(restored.recipe().seed, 5);
    assert_eq!(restored.session.history.len(), 3);
    assert_eq!(restored.session.library.saved[0].name, "Una forma");
    assert_eq!(restored.session.library.favorites.len(), 1);
}
