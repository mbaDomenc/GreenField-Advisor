from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from enum import Enum
from .base import ProcessorBase, PipelineContext, PipelineStage

class PlantType(str, Enum):
    TOMATO = "tomato"
    POTATO = "potato"
    PEACH = "peach"
    GRAPE = "grape"
    PEPPER = "pepper"
    GENERIC = "generic"

class IrrigationDecision(str, Enum):
    DO_NOT_WATER = "do_not_water"
    WATER_INTEGRATION = "water_integration" # 🟢 STATO NUOVO
    WATER_STANDARD = "water_standard" # 🟢 STATO NUOVO
    WATER_HEAVY = "water_heavy"
    WATER_LIGHT = "water_light" # Mantenuto per compatibilità
    WATER_MODERATE = "water_moderate" # Mantenuto per compatibilità

class IrrigationStrategy(ABC):
    @abstractmethod
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        pass
    
    def _calculate_gap(self, current, target, swrf, ml_per_pct):
        gap = target - current
        if gap <= 0: return 0, IrrigationDecision.DO_NOT_WATER
        
        amount = gap * ml_per_pct * swrf
        
        if gap < 15: decision = IrrigationDecision.WATER_INTEGRATION
        elif gap < 30: decision = IrrigationDecision.WATER_STANDARD
        else: decision = IrrigationDecision.WATER_HEAVY
            
        return round(amount, 0), decision

class TomatoStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        # Target Pomodoro: 80%
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 80.0, features.get("soil_retention_factor", 1.0), 50.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.9, "reasoning": f"Gap idrico calcolato su target 80%.", "plant_type": "tomato"}

class PotatoStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        # Target Patata: 75%
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 75.0, features.get("soil_retention_factor", 1.0), 45.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.85, "reasoning": f"Gap idrico su target 75%.", "plant_type": "potato"}

class PepperStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        # Target Peperone: 75%
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 75.0, features.get("soil_retention_factor", 1.0), 40.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.85, "reasoning": f"Gap idrico su target 75%.", "plant_type": "pepper"}

class PeachStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        # Target Pesco: 60% (ma alto volume)
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 60.0, features.get("soil_retention_factor", 1.0), 150.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.85, "reasoning": f"Gap idrico albero.", "plant_type": "peach"}

class GrapeStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        # Target Vite: 45%
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 45.0, features.get("soil_retention_factor", 1.0), 80.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.9, "reasoning": f"Gap idrico vite.", "plant_type": "grape"}

class GenericStrategy(IrrigationStrategy):
    def estimate(self, cleaned_data: Dict[str, Any], features: Dict[str, Any]) -> Dict[str, Any]:
        amt, dec = self._calculate_gap(cleaned_data.get("soil_moisture", 50), 65.0, features.get("soil_retention_factor", 1.0), 35.0)
        return {"should_water": dec != IrrigationDecision.DO_NOT_WATER, "decision": dec.value, "water_amount_ml": amt, "confidence": 0.5, "reasoning": "Gap generico.", "plant_type": "generic"}

class IrrigationEstimator(ProcessorBase):
    def __init__(self, plant_type: Optional[str] = None):
        super().__init__("Irrigation Estimator")
        self.strategies = {
            PlantType.TOMATO: TomatoStrategy(), PlantType.POTATO: PotatoStrategy(),
            PlantType.PEACH: PeachStrategy(), PlantType.GRAPE: GrapeStrategy(),
            PlantType.PEPPER: PepperStrategy(), PlantType.GENERIC: GenericStrategy()
        }
        self.plant_type = plant_type or PlantType.GENERIC.value
        
    def _get_stage(self) -> PipelineStage: return PipelineStage.ESTIMATION
    
    def _execute(self, context: PipelineContext) -> Dict[str, Any]:
        if not context.cleaned_data: raise ValueError("Dati puliti non disponibili.")
        pt = PlantType(self.plant_type) if self.plant_type in [p.value for p in PlantType] else PlantType.GENERIC
        estimation = self.strategies[pt].estimate(context.cleaned_data, context.features or {})
        context.estimation = estimation
        return {"estimation": estimation}