use crate::game::{combat, players};
use crate::types::ability::{
    DelayedTriggerCondition, Effect, EffectError, QuantityExpr, ResolvedAbility, TargetFilter,
};
use crate::types::events::GameEvent;
use crate::types::game_state::{DelayedTrigger, GameState};
use crate::types::phase::Phase;
use crate::types::player::PlayerId;
use crate::types::zones::Zone;

/// CR 702.116a: Myriad creates a tapped attacking copy for each opponent
/// other than the defending player for the source creature. The current engine
/// chooses the player branch of "that player or a planeswalker they control";
/// planeswalker redirection can be layered on when that choice UI exists.
pub fn resolve(
    state: &mut GameState,
    ability: &ResolvedAbility,
    events: &mut Vec<GameEvent>,
) -> Result<(), EffectError> {
    if !matches!(ability.effect, Effect::Myriad) {
        return Err(EffectError::MissingParam("Myriad".to_string()));
    }

    let Some(defending_player) = combat::defending_player_for_attacker(state, ability.source_id)
    else {
        events.push(GameEvent::EffectResolved {
            kind: crate::types::ability::EffectKind::Myriad,
            source_id: ability.source_id,
        });
        return Ok(());
    };

    let opponents: Vec<PlayerId> = players::opponents(state, ability.controller)
        .into_iter()
        .filter(|opponent| *opponent != defending_player)
        .collect();
    let mut created = Vec::new();

    for opponent in opponents {
        let copy_effect = Effect::CopyTokenOf {
            target: TargetFilter::SelfRef,
            source_filter: None,
            enters_attacking: false,
            tapped: true,
            count: QuantityExpr::Fixed { value: 1 },
            extra_keywords: vec![],
            additional_modifications: vec![],
        };
        let copy_ability =
            ResolvedAbility::new(copy_effect, vec![], ability.source_id, ability.controller);
        crate::game::effects::token_copy::resolve(state, &copy_ability, events)?;

        let token_ids = state.last_created_token_ids.clone();
        for token_id in token_ids {
            combat::place_attacking_alongside(
                state,
                token_id,
                opponent,
                combat::AttackTarget::Player(opponent),
                events,
            );
            created.push(token_id);
        }
    }

    if !created.is_empty() {
        state.delayed_triggers.push(DelayedTrigger {
            condition: DelayedTriggerCondition::AtNextPhase {
                phase: Phase::EndCombat,
            },
            ability: ResolvedAbility::new(
                Effect::ChangeZone {
                    origin: Some(Zone::Battlefield),
                    destination: Zone::Exile,
                    target: TargetFilter::Any,
                    owner_library: false,
                    enter_transformed: false,
                    under_your_control: false,
                    enter_tapped: false,
                    enters_attacking: false,
                    up_to: false,
                    enter_with_counters: vec![],
                },
                created
                    .iter()
                    .copied()
                    .map(crate::types::ability::TargetRef::Object)
                    .collect(),
                ability.source_id,
                ability.controller,
            ),
            controller: ability.controller,
            source_id: ability.source_id,
            one_shot: true,
        });
    }

    events.push(GameEvent::EffectResolved {
        kind: crate::types::ability::EffectKind::Myriad,
        source_id: ability.source_id,
    });
    Ok(())
}
