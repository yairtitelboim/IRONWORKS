#!/usr/bin/env python3
"""
API Usage Tracker Module

This module provides utilities for tracking and logging API usage across
the planning document processing pipeline, with a focus on cost control
and usage transparency.
"""

import os
import json
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class APIUsageTracker:
    """
    Tracks API usage across the document processing pipeline.
    
    This class helps monitor API usage, estimate costs, and enforce usage limits
    to prevent unexpected expenses.
    """
    
    def __init__(self, output_dir: str, max_calls_per_run: int = 10):
        """
        Initialize the API usage tracker.
        
        Args:
            output_dir: Directory to save usage logs
            max_calls_per_run: Maximum number of API calls allowed per run
        """
        self.output_dir = Path(output_dir)
        self.usage_log_path = self.output_dir / "api_usage_summary.txt"
        self.detailed_log_path = self.output_dir / "api_usage_detailed.json"
        self.max_calls_per_run = max_calls_per_run
        
        # Initialize usage counters
        self.call_count = 0
        self.total_tokens = 0
        self.call_history = []
        
        # Estimated cost tracking (based on approximate rates)
        self.estimated_cost = 0.0
        
        # Model-specific cost estimates per 1K tokens (input + output)
        self.cost_per_1k_tokens = {
            "gpt-4o": 0.015,            # $0.015 per 1K tokens
            "gpt-4o-mini": 0.005,       # $0.005 per 1K tokens
            "claude-3-sonnet": 0.015,   # $0.015 per 1K tokens
            "default": 0.01             # Default fallback rate
        }
        
        # Load existing usage if available
        self._load_existing_usage()
        
        logger.info(f"API Usage Tracker initialized with max {max_calls_per_run} calls per run")
        logger.info(f"Usage logs will be saved to {self.usage_log_path}")
    
    def _load_existing_usage(self) -> None:
        """Load existing usage data from the log file if available."""
        if self.detailed_log_path.exists():
            try:
                with open(self.detailed_log_path, 'r') as f:
                    usage_data = json.load(f)
                    
                # Initialize from saved data if it has the expected format
                if isinstance(usage_data, dict) and 'call_count' in usage_data:
                    self.call_count = usage_data.get('total_call_count', 0)
                    self.total_tokens = usage_data.get('total_tokens', 0)
                    self.estimated_cost = usage_data.get('total_estimated_cost', 0.0)
                    self.call_history = usage_data.get('call_history', [])
                    
                    logger.info(f"Loaded existing usage data: {self.call_count} calls, ${self.estimated_cost:.4f} estimated cost")
            except Exception as e:
                logger.warning(f"Error loading existing usage data: {e}")
    
    def track_api_call(self, 
                       model: str, 
                       input_tokens: int, 
                       output_tokens: int, 
                       document_id: str = "",
                       processing_stage: str = "extraction") -> bool:
        """
        Track an API call and update the usage statistics.
        
        Args:
            model: The model used for the API call (e.g., "gpt-4o")
            input_tokens: Number of input tokens in the call
            output_tokens: Number of output tokens in the call
            document_id: Optional ID of the document being processed
            processing_stage: Stage of processing (extraction, classification, etc.)
            
        Returns:
            bool: True if the call is allowed, False if over the limit
        """
        # Check if we're over the limit
        if self.call_count >= self.max_calls_per_run:
            logger.warning(f"API call limit reached ({self.max_calls_per_run}). Call blocked.")
            return False
        
        # Calculate cost based on token usage
        total_tokens = input_tokens + output_tokens
        cost_rate = self.cost_per_1k_tokens.get(model, self.cost_per_1k_tokens["default"])
        estimated_cost = (total_tokens / 1000) * cost_rate
        
        # Track the call
        self.call_count += 1
        self.total_tokens += total_tokens
        self.estimated_cost += estimated_cost
        
        # Add to call history
        self.call_history.append({
            "timestamp": datetime.now().isoformat(),
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "total_tokens": total_tokens,
            "estimated_cost": estimated_cost,
            "document_id": document_id,
            "processing_stage": processing_stage
        })
        
        logger.info(f"API call tracked: {model}, {total_tokens} tokens, ${estimated_cost:.5f}")
        logger.info(f"Usage: {self.call_count}/{self.max_calls_per_run} calls, ${self.estimated_cost:.5f} total")
        
        # Save updated usage log
        self._save_usage_logs()
        
        return True
    
    def estimate_prompt_tokens(self, text: str) -> int:
        """
        Estimate the number of tokens in a text string.
        
        This is a rough estimation based on words and characters.
        For more accurate counts, use the tokenizer from the specific model.
        
        Args:
            text: The text to estimate token count for
            
        Returns:
            int: Estimated token count
        """
        # Simple estimation: ~4 chars per token on average for English text
        # This is a rough approximation
        char_count = len(text)
        estimated_tokens = max(1, char_count // 4)
        return estimated_tokens
    
    def can_make_api_call(self) -> bool:
        """Check if additional API calls are allowed under current limits."""
        return self.call_count < self.max_calls_per_run
    
    def remaining_calls(self) -> int:
        """Get the number of remaining API calls allowed."""
        return max(0, self.max_calls_per_run - self.call_count)
    
    def _save_usage_logs(self) -> None:
        """Save the usage logs to disk."""
        # Create the output directory if it doesn't exist
        self.output_dir.mkdir(exist_ok=True, parents=True)
        
        # Save detailed JSON log
        try:
            with open(self.detailed_log_path, 'w') as f:
                json.dump({
                    "last_updated": datetime.now().isoformat(),
                    "total_call_count": self.call_count,
                    "total_tokens": self.total_tokens,
                    "total_estimated_cost": self.estimated_cost,
                    "max_calls_per_run": self.max_calls_per_run,
                    "call_history": self.call_history
                }, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving detailed usage log: {e}")
        
        # Save human-readable summary
        try:
            with open(self.usage_log_path, 'w') as f:
                f.write(f"API Usage Summary (as of {datetime.now().isoformat()})\n")
                f.write(f"----------------------------------------------------\n")
                f.write(f"Total API calls made: {self.call_count}\n")
                f.write(f"Total tokens used: {self.total_tokens}\n")
                f.write(f"Estimated cost: ${self.estimated_cost:.5f}\n")
                f.write(f"Call limit per run: {self.max_calls_per_run}\n")
                f.write(f"\nUsage by model:\n")
                
                # Group usage by model
                model_usage = {}
                for call in self.call_history:
                    model = call["model"]
                    if model not in model_usage:
                        model_usage[model] = {
                            "calls": 0,
                            "tokens": 0,
                            "cost": 0.0
                        }
                    model_usage[model]["calls"] += 1
                    model_usage[model]["tokens"] += call["total_tokens"]
                    model_usage[model]["cost"] += call["estimated_cost"]
                
                # Write model-specific usage
                for model, usage in model_usage.items():
                    f.write(f"  {model}: {usage['calls']} calls, {usage['tokens']} tokens, ${usage['cost']:.5f}\n")
        except Exception as e:
            logger.error(f"Error saving usage summary: {e}")
    
    def get_usage_summary(self) -> Dict[str, Any]:
        """Get a summary of the API usage."""
        return {
            "call_count": self.call_count,
            "total_tokens": self.total_tokens,
            "estimated_cost": self.estimated_cost,
            "max_calls_per_run": self.max_calls_per_run,
            "remaining_calls": self.remaining_calls()
        }

# Global tracker instance (singleton)
_TRACKER_INSTANCE = None

def get_tracker(output_dir: str = "public/processed_planning_docs", max_calls: int = 10) -> APIUsageTracker:
    """
    Get the global API usage tracker instance.
    
    Args:
        output_dir: Directory to save usage logs
        max_calls: Maximum API calls allowed per run
        
    Returns:
        APIUsageTracker: The global tracker instance
    """
    global _TRACKER_INSTANCE
    
    if _TRACKER_INSTANCE is None:
        _TRACKER_INSTANCE = APIUsageTracker(output_dir, max_calls)
    
    return _TRACKER_INSTANCE 