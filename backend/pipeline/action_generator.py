"""
Step 5: Action Suggestion Generator
"""

from typing import Dict, Any, List
from datetime import datetime, timedelta
from .base import ProcessorBase, PipelineContext, PipelineStage

class ActionGenerator(ProcessorBase):
    
    def __init__(self):
        super().__init__("Action Generator")
        
    def _get_stage(self) -> PipelineStage:
        return PipelineStage.ACTION_GENERATION
        
    def _execute(self, context: PipelineContext) -> Dict[str, Any]:
        if not context.estimation: raise ValueError("Estimation non disponibile.")
        
        main_action = self._generate_main_action(context)
        secondary_actions = self._generate_secondary_actions(context)
        timing = self._suggest_timing(context)
        frequency_estimation = self._estimate_irrigation_frequency(context)
        fertilizer_estimation = self._estimate_fertilizer(context)
        notes = self._generate_notes(context)
        
        suggestions = {
            "main_action": main_action,
            "secondary_actions": secondary_actions,
            "timing": timing,
            "frequency_estimation": frequency_estimation,
            "fertilizer_estimation": fertilizer_estimation, 
            "notes": notes,
            "priority": self._calculate_priority(context),
            "generated_at": datetime.utcnow().isoformat()
        }
        context.suggestions = suggestions
        return {"suggestions": suggestions}
        
    def _estimate_irrigation_frequency(self, context: PipelineContext) -> Dict[str, str]:
        features = context.features or {}
        et0 = features.get("evapotranspiration", 0) 
        swrf = features.get("soil_retention_factor", 1.0) 
        plant_type = context.raw_data.get("plant_type", "generic").lower()

        is_tree = any(p in plant_type for p in ["peach", "pesca", "grape", "uva", "vite"])
        tree_factor = 2.0 if is_tree else 1.0

        if et0 > 0:
            base_days = max(1.0, (4.0 * tree_factor) / et0) 
        else:
            base_days = 7.0 * tree_factor
            
        adjusted_days = base_days * swrf 

        if adjusted_days <= 2:
             detail = "Molto Frequente (1-2 gg)"
             label = "ALTA"
        elif adjusted_days <= 5:
             detail = "Frequente (3-5 gg)"
             label = "MEDIA"
        elif adjusted_days <= 10:
             detail = "Settimanale"
             label = "BASSA"
        else:
             detail = "Rara / Quindicinale"
             label = "MINIMA"
            
        return {
            "label": label,
            "detail": detail,
            "icon": label.lower(),
            "reasoning": f"Frequenza calcolata su ET0 e tipo pianta (Albero={is_tree})."
        }

    def _estimate_fertilizer(self, context: PipelineContext) -> Dict[str, str]:
        """Stima concimazione per Pomodoro, Patata, Peperone, Pesca, Uva."""
        plant_type = context.raw_data.get("plant_type", "generic").lower()
        if "species" in context.raw_data: plant_type = str(context.raw_data["species"]).lower()
        
        soil_type = context.cleaned_data.get("soil", "universale").lower()
        
        # 1. Classificazione
        is_tomato = "tomato" in plant_type or "pomodoro" in plant_type
        is_potato = "potato" in plant_type or "patata" in plant_type
        is_pepper = "pepper" in plant_type or "peperone" in plant_type
        is_peach = "peach" in plant_type or "pesca" in plant_type
        is_grape = "grape" in plant_type or "uva" in plant_type or "vite" in plant_type

        # 2. Logica Specifica
        if is_tomato or is_potato or is_pepper:
            tipo = "NPK ricco di Potassio (K)"
            base_freq = 14
            desc = "Solanacee: alta richiesta nutritiva durante la fruttificazione."
        elif is_peach:
            tipo = "Organico granulare a lento rilascio"
            base_freq = 60 
            desc = "Albero da frutto: concimazione stagionale."
        elif is_grape:
            tipo = "Concime specifico Vite (Mg/K)"
            base_freq = 45
            desc = "Vite: integrazioni mirate, evitare eccesso azoto."
        else:
            tipo = "Universale NPK"
            base_freq = 30
            desc = "Concimazione standard."

        # 3. Modulazione Terreno
        if "sabbioso" in soil_type:
            final_freq = int(base_freq * 0.6)
            advice = f"{desc} Terreno SABBIOSO: dilavamento. Dosi ridotte ma frequenti."
        elif "argilloso" in soil_type:
            final_freq = int(base_freq * 1.2)
            advice = f"{desc} Terreno ARGILLOSO: trattiene i sali. Concimare meno spesso."
        else:
            final_freq = base_freq
            advice = f"{desc} Terreno equilibrato."

        return {
            "frequency": f"Ogni {final_freq} giorni",
            "type": tipo,
            "reasoning": advice
        }

    def _generate_main_action(self, context: PipelineContext) -> Dict[str, Any]:
        estimation = context.estimation
        
        return {
            "action": "irrigate" if estimation["should_water"] else "do_not_irrigate",
            "decision": estimation["decision"],
            "water_amount_ml": estimation["water_amount_ml"],
            "water_amount_liters": round(estimation["water_amount_ml"] / 1000, 2),
            "reasoning": estimation["reasoning"],
            "confidence": estimation["confidence"],
            "description": self._get_action_description(estimation)
        }

    def _get_action_description(self, estimation: Dict[str, Any]) -> str:
        l = estimation["water_amount_ml"] / 1000
        d = estimation["decision"]
        
        if not estimation["should_water"]: return "Livello ottimale. Non irrigare."
        
        # 🟢 MESSAGGIO INTEGRAZIONE
        if d == "water_integration":
            return f"Integrazione necessaria: mancano circa {l:.1f} litri per il target ottimale."
            
        return f"Consigliata irrigazione di circa {l:.1f} litri."

    def _generate_secondary_actions(self, context: PipelineContext) -> List[Dict[str, Any]]:
        actions = []
        return actions

    def _suggest_timing(self, context: PipelineContext) -> Dict[str, Any]:
        return {
            "suggested_time": "Mattino presto",
            "next_window": datetime.now().isoformat(),
            "current_phase": "day",
            "ideal_hours": ["06:00-09:00"]
        }

    def _generate_notes(self, context: PipelineContext) -> List[str]:
        return context.warnings or []

    def _calculate_priority(self, context: PipelineContext) -> str:
        return "medium"