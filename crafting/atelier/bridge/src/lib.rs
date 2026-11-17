//! Eveniunt Atelier bridge. Exposes the Raphael crafting solver
//! (https://github.com/KonaeAkira/raphael-rs, Apache-2.0, commit 723b17e) to
//! JavaScript as JSON-in/JSON-out functions. Raphael's crates are used
//! unchanged. `create_macros` follows raphael-gui/src/macros.rs (Apache-2.0).

use raphael_data::{
    Consumable, CrafterStats, CustomRecipeOverrides, Locale, MEALS, POTIONS, RECIPES, get_game_settings,
    get_initial_quality, get_item_name, macro_name, action_name,
};
use raphael_sim::{Action, Condition, Settings, SimulationState};
use serde::Deserialize;
use serde_json::{Value, json};
use strum::IntoEnumIterator;
use wasm_bindgen::prelude::*;

/// Multi-core build only: start the rayon thread pool (call once in the solver worker).
#[cfg(feature = "threads")]
pub use wasm_bindgen_rayon::init_thread_pool;

fn locale(code: &str) -> Locale {
    match code {
        "de" => Locale::DE, "fr" => Locale::FR, "jp" | "ja" => Locale::JP, "cn" | "zh" => Locale::CN,
        "kr" | "ko" => Locale::KR, "tw" => Locale::TW, _ => Locale::EN,
    }
}

fn err(msg: impl ToString) -> String { json!({ "error": msg.to_string() }).to_string() }

fn consumable(list: &[Consumable], id: u32, hq: bool) -> Option<Consumable> {
    list.iter().copied().find(|c| c.item_id == id && c.hq == hq)
}

fn action_by_index(i: usize) -> Option<Action> { Action::iter().nth(i) }
fn action_index(a: Action) -> usize { Action::iter().position(|x| x == a).unwrap_or(0) }

/// All actions with their localized and macro names and macro wait times.
#[wasm_bindgen]
pub fn actions(loc: &str) -> String {
    let l = locale(loc);
    let v: Vec<Value> = Action::iter().enumerate().map(|(i, a)| json!({
        "index": i, "key": format!("{a:?}"), "name": action_name(a, l), "macro": macro_name(a, l), "wait": a.time_cost()
    })).collect();
    Value::Array(v).to_string()
}

fn recipe_json(id: u32, r: &raphael_data::Recipe, l: Locale) -> Value {
    let rl = raphael_data::RLVLS.get(usize::from(r.recipe_level)).copied();
    json!({
        "id": id, "job": r.job_id, "itemId": r.item_id,
        "name": get_item_name(r.item_id, false, l).unwrap_or_default(),
        "rlvl": r.recipe_level, "level": rl.map(|x| x.job_level).unwrap_or(0),
        "expert": r.is_expert, "maxLevelScaling": r.max_level_scaling,
        "reqCraftsmanship": r.req_craftsmanship, "reqControl": r.req_control,
        "progress": rl.map(|x| x.max_progress * r.progress_factor / 100).unwrap_or(0),
        "quality": rl.map(|x| x.max_quality * r.quality_factor / 100).unwrap_or(0),
        "durability": rl.map(|x| x.max_durability * r.durability_factor / 100).unwrap_or(0),
        "ingredients": r.ingredients.iter().filter(|i| i.item_id != 0).map(|i| json!({
            "itemId": i.item_id, "amount": i.amount, "name": get_item_name(i.item_id, false, l).unwrap_or_default(),
            "hqable": raphael_data::ITEMS.get(i.item_id).is_some()
        })).collect::<Vec<_>>(),
        "stellarMission": raphael_data::RECIPE_TO_STELLAR_MISSION_LINKS.get(id).copied(),
        "alwaysCollectable": raphael_data::ITEMS.get(r.item_id).map(|i| i.always_collectable).unwrap_or(false),
    })
}

/// Fuzzy recipe search (Raphael's matcher). job < 0 = all jobs.
#[wasm_bindgen]
pub fn search_recipes(text: &str, loc: &str, job: i32, limit: usize) -> String {
    let l = locale(loc);
    let q = raphael_data::RecipeSearchQuery {
        text, locale: l,
        filters: raphael_data::RecipeFilters { job_id: if job < 0 { None } else { Some(job as u8) }, ..Default::default() },
    };
    let v: Vec<Value> = raphael_data::find_recipes(q).take(limit).map(|(id, r)| recipe_json(id, r, l)).collect();
    Value::Array(v).to_string()
}

#[wasm_bindgen]
pub fn recipe(id: u32, loc: &str) -> String {
    match RECIPES.get(id) { Some(r) => recipe_json(id, r, locale(loc)).to_string(), None => err("unknown recipe") }
}

/// Every expert recipe id (for the Atelier's expert flow).
#[wasm_bindgen]
pub fn expert_recipe_count() -> usize { RECIPES.values().filter(|r| r.is_expert).count() }

fn consumables_json(list: &[Consumable], l: Locale) -> Value {
    Value::Array(list.iter().map(|c| json!({
        "id": c.item_id, "hq": c.hq, "ilvl": c.item_level, "name": get_item_name(c.item_id, c.hq, l).unwrap_or_default(),
        "craftRel": c.craft_rel, "craftMax": c.craft_max, "controlRel": c.control_rel, "controlMax": c.control_max,
        "cpRel": c.cp_rel, "cpMax": c.cp_max
    })).collect())
}
#[wasm_bindgen] pub fn meals(loc: &str) -> String { consumables_json(MEALS, locale(loc)).to_string() }
#[wasm_bindgen] pub fn potions(loc: &str) -> String { consumables_json(POTIONS, locale(loc)).to_string() }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Req {
    recipe_id: Option<u32>,
    #[serde(default)] custom: Option<CustomReq>,
    stats: StatsReq,
    food: Option<(u32, bool)>,
    potion: Option<(u32, bool)>,
    #[serde(default)] hq_ingredients: [u8; 6],
    initial_quality: Option<u16>,
    #[serde(default)] target_quality: Option<u16>,
    #[serde(default)] adversarial: bool,
    #[serde(default)] backload_progress: bool,
    #[serde(default)] must_reach_target: bool,
    #[serde(default)] ssh_charges: u8,
}
fn yes() -> bool { true }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatsReq { craftsmanship: u16, control: u16, cp: u16, level: u8,
    #[serde(default = "yes")] manipulation: bool, #[serde(default)] heart_and_soul: bool, #[serde(default)] quick_innovation: bool }
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CustomReq { rlvl: u16, job_level: u8, max_progress: u16, max_quality: u16, max_durability: u16,
    base_progress: Option<u16>, base_quality: Option<u16>, expert: bool }

struct Prepared { settings: Settings, initial_quality: u16, target: u16, must: bool }

fn prepare(req: &Req) -> Result<Prepared, String> {
    let stats = CrafterStats { craftsmanship: req.stats.craftsmanship, control: req.stats.control, cp: req.stats.cp,
        level: req.stats.level, manipulation: req.stats.manipulation, heart_and_soul: req.stats.heart_and_soul,
        quick_innovation: req.stats.quick_innovation };
    let food = req.food.and_then(|(id, hq)| consumable(MEALS, id, hq));
    let potion = req.potion.and_then(|(id, hq)| consumable(POTIONS, id, hq));
    let (recipe, overrides) = match (req.recipe_id, &req.custom) {
        (Some(id), None) => (*RECIPES.get(id).ok_or("unknown recipe")?, None),
        (_, Some(c)) => {
            let mut r = *RECIPES.values().next().ok_or("no recipes")?;
            r.max_level_scaling = 0; r.req_craftsmanship = 0; r.req_control = 0;
            r.recipe_level = c.rlvl; r.is_expert = c.expert; r.job_id = 0;
            r.progress_factor = 100; r.quality_factor = 100; r.durability_factor = 100;
            let _ = c.job_level;
            (r, Some(CustomRecipeOverrides { max_progress_override: c.max_progress, max_quality_override: c.max_quality,
                max_durability_override: c.max_durability, base_progress_override: c.base_progress, base_quality_override: c.base_quality }))
        }
        _ => return Err("no recipe".into()),
    };
    let mut settings = get_game_settings(recipe, overrides, stats, food, potion);
    settings.adversarial = req.adversarial;
    settings.backload_progress = req.backload_progress;
    settings.stellar_steady_hand_charges = req.ssh_charges;
    let iq = req.initial_quality.unwrap_or_else(|| get_initial_quality(stats, recipe, req.hq_ingredients));
    let target = req.target_quality.unwrap_or(settings.max_quality).min(settings.max_quality);
    Ok(Prepared { settings, initial_quality: iq, target, must: req.must_reach_target })
}

fn settings_json(p: &Prepared) -> Value {
    let s = &p.settings;
    json!({ "maxCp": s.max_cp, "maxDurability": s.max_durability, "maxProgress": s.max_progress, "maxQuality": s.max_quality,
        "baseProgress": s.base_progress, "baseQuality": s.base_quality, "jobLevel": s.job_level,
        "initialQuality": p.initial_quality, "targetQuality": p.target, "adversarial": s.adversarial,
        "backloadProgress": s.backload_progress, "sshCharges": s.stellar_steady_hand_charges })
}

/// Game settings for a request (stats incl. consumables applied by Raphael).
#[wasm_bindgen]
pub fn settings(req: &str) -> String {
    let r: Req = match serde_json::from_str(req) { Ok(r) => r, Err(e) => return err(e) };
    match prepare(&r) { Ok(p) => settings_json(&p).to_string(), Err(e) => err(e) }
}

/// Run Raphael's MacroSolver. `progress(nodes)` and `solution(actionIndices)` are called during the search.
#[wasm_bindgen]
pub fn solve(req: &str, progress: &js_sys::Function, solution: &js_sys::Function) -> String {
    let r: Req = match serde_json::from_str(req) { Ok(r) => r, Err(e) => return err(e) };
    let p = match prepare(&r) { Ok(p) => p, Err(e) => return err(e) };
    let mut sim = p.settings;
    sim.max_quality = p.target.saturating_sub(p.initial_quality);
    let solver_settings = raphael_solver::SolverSettings { simulator_settings: sim, allow_non_max_quality_solutions: !p.must };
    let prog = progress.clone();
    let sol = solution.clone();
    let mut solver = raphael_solver::MacroSolver::new(
        solver_settings,
        Box::new(move |acts: &[Action]| {
            let arr = js_sys::Array::new();
            for a in acts { arr.push(&JsValue::from(action_index(*a) as u32)); }
            let _ = sol.call1(&JsValue::NULL, &arr);
        }),
        Box::new(move |n: usize| { let _ = prog.call1(&JsValue::NULL, &JsValue::from(n as f64)); }),
        raphael_solver::AtomicFlag::new(),
    );
    match solver.solve() {
        Ok(acts) => json!({ "actions": acts.iter().map(|a| action_index(*a)).collect::<Vec<_>>(), "settings": settings_json(&p) }).to_string(),
        Err(e) => err(format!("{e:?}")),
    }
}

/// Simulate a rotation under Normal conditions (Raphael's simulator); returns per-step states.
#[wasm_bindgen]
pub fn simulate(req: &str, actions: &[u32]) -> String {
    let r: Req = match serde_json::from_str(req) { Ok(r) => r, Err(e) => return err(e) };
    let p = match prepare(&r) { Ok(p) => p, Err(e) => return err(e) };
    let mut s = p.settings;
    s.adversarial = false;
    let mut st = SimulationState::new(&s);
    st.quality = p.initial_quality;
    let mut out = Vec::new();
    for &i in actions {
        let Some(a) = action_by_index(i as usize) else { return err("bad action index") };
        match st.use_action(a, Condition::Normal, &s) {
            Ok(n) => { st = n; out.push(json!({ "progress": st.progress, "quality": st.quality, "durability": st.durability, "cp": st.cp })); }
            Err(e) => { out.push(json!({ "error": format!("{e:?}") })); break; }
        }
    }
    json!({ "steps": out, "settings": settings_json(&p) }).to_string()
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct MacroCfg {
    split_macro: bool, include_delay: bool, extra_delay: u8, notification_enabled: bool, default_notification: bool,
    notification_sound: u8, custom_notification_format: String, different_last_notification: bool,
    custom_last_notification_format: String, avoid_single_action_macro: bool, intro_enabled: bool, default_intro: bool,
    custom_intro_format: String, item_name: String, food_name: String, potion_name: String,
    craftsmanship: u16, control: u16, cp: u16, level: u8,
}
impl Default for MacroCfg { fn default() -> Self { Self { split_macro: true, include_delay: true, extra_delay: 0, notification_enabled: false,
    default_notification: true, notification_sound: 1, custom_notification_format: String::new(), different_last_notification: false,
    custom_last_notification_format: String::new(), avoid_single_action_macro: false, intro_enabled: false, default_intro: true,
    custom_intro_format: String::new(), item_name: String::new(), food_name: String::new(), potion_name: String::new(),
    craftsmanship: 0, control: 0, cp: 0, level: 0 } } }

/// Macro text, following raphael-gui `create_macros` exactly.
#[wasm_bindgen]
pub fn macros(cfg: &str, actions: &[u32], loc: &str) -> String {
    let c: MacroCfg = match serde_json::from_str(cfg) { Ok(c) => c, Err(e) => return err(e) };
    let l = locale(loc);
    let acts: Vec<Action> = actions.iter().filter_map(|&i| action_by_index(i as usize)).collect();
    let max_len = if c.split_macro { 15 } else { usize::MAX };
    let mut macros: Vec<(String, u16)> = Vec::new();
    let mut cur: Vec<String> = Vec::new();
    let mut dur: u16 = 0;
    for (idx, a) in acts.iter().enumerate() {
        let remaining = acts.len() - idx - 1;
        if c.intro_enabled && cur.is_empty() {
            cur.push(if c.default_intro { "/macrolock".to_string() } else { c.custom_intro_format.clone() });
        }
        if c.include_delay { cur.push(format!("/ac \"{}\" <wait.{}>", macro_name(*a, l), a.time_cost() + c.extra_delay)); }
        else { cur.push(format!("/ac \"{}\"", macro_name(*a, l))); }
        dur += u16::from(a.time_cost());
        if c.include_delay { dur += u16::from(c.extra_delay); }
        if c.notification_enabled && cur.len() < max_len && (cur.len() + 1 == max_len || remaining == 0)
            && !(c.avoid_single_action_macro && remaining == 1) {
            let n = if c.default_notification { format!("/echo Macro finished ({{index}}/{{max_index}}) <se.{}>", c.notification_sound) }
                else if c.different_last_notification && remaining == 0 { c.custom_last_notification_format.clone() }
                else { c.custom_notification_format.clone() };
            cur.push(n);
        }
        if cur.len() >= max_len || remaining == 0 { macros.push((cur.join("\n"), dur)); cur.clear(); dur = 0; }
    }
    let max_index = macros.len().to_string();
    let out: Vec<Value> = macros.into_iter().enumerate().map(|(i, (t, d))| {
        let t = t.replace("{index}", &(i + 1).to_string()).replace("{max_index}", &max_index)
            .replace("{item_name}", &c.item_name).replace("{food}", &c.food_name).replace("{potion}", &c.potion_name)
            .replace("{craftsmanship}", &c.craftsmanship.to_string()).replace("{control}", &c.control.to_string())
            .replace("{cp}", &c.cp.to_string()).replace("{level}", &c.level.to_string());
        json!({ "text": t, "duration": d })
    }).collect();
    Value::Array(out).to_string()
}

fn zone_from(code: i32) -> Option<raphael_data::CosmicExplorationZone> {
    use raphael_data::CosmicExplorationZone as Z;
    match code { 0 => Some(Z::SinusArdorum), 1 => Some(Z::Phaenna), 2 => Some(Z::Oizys), 3 => Some(Z::Auxesia), _ => None }
}

/// Stellar mission search (Raphael's matcher). job/zone < 0 = any.
#[wasm_bindgen]
pub fn search_missions(text: &str, loc: &str, job: i32, zone: i32, limit: usize) -> String {
    let l = locale(loc);
    let q = raphael_data::StellarSearchQuery {
        text, locale: l,
        filters: raphael_data::StellarMissionFilters { job_id: if job < 0 { None } else { Some(job as u8) }, zone: zone_from(zone) },
    };
    let v: Vec<Value> = raphael_data::find_stellar_missions(q).take(limit).map(|(mid, m)| json!({
        "missionId": mid, "name": raphael_data::get_stellar_mission_name(mid, l).unwrap_or_default(), "job": m.job_id,
        "zone": format!("{:?}", raphael_data::CosmicExplorationZone::from_mission_id(mid)),
        "sshCharges": m.stellar_steady_hand_charges,
        "recipes": m.recipe_ids.iter().filter_map(|&rid| RECIPES.get(rid).map(|r| recipe_json(rid, r, l))).collect::<Vec<_>>()
    })).collect();
    Value::Array(v).to_string()
}

#[wasm_bindgen]
pub fn job_names(loc: &str) -> String {
    let l = locale(loc);
    Value::Array((0..8).map(|j| Value::from(raphael_data::get_job_name(j, l))).collect()).to_string()
}

#[wasm_bindgen]
pub fn zone_names(loc: &str) -> String {
    use raphael_data::CosmicExplorationZone as Z;
    let l = locale(loc);
    Value::Array([Z::SinusArdorum, Z::Phaenna, Z::Oizys, Z::Auxesia].iter()
        .map(|z| Value::from(raphael_data::get_cosmic_exploration_zone_name(*z, l))).collect()).to_string()
}

#[derive(serde::Serialize, Deserialize)]
struct CrafterConfig { selected_job: u8, crafter_stats: [CrafterStats; 8] }

/// Raphael-compatible crafter config (RON), so configs copied on raphael-xiv.com paste here and back.
#[wasm_bindgen]
pub fn config_to_ron(json_cfg: &str) -> String {
    match serde_json::from_str::<CrafterConfig>(json_cfg) {
        Ok(c) => ron::to_string(&c).unwrap_or_else(err),
        Err(e) => err(e),
    }
}
#[wasm_bindgen]
pub fn config_from_ron(text: &str) -> String {
    match ron::from_str::<CrafterConfig>(text.trim()) {
        Ok(c) => serde_json::to_string(&c).unwrap_or_else(err),
        Err(e) => err(e),
    }
}

/// Raphael's HQ chance for a quality value (in-game table).
#[wasm_bindgen]
pub fn hq_percentage(quality: u32, max_quality: u32) -> u32 {
    raphael_data::hq_percentage(quality, max_quality).map(u32::from).unwrap_or(0)
}
