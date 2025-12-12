# coding: UTF-8
import os
import random

import math
import re
import time
from datetime import datetime, timezone

import numpy
from hyperopt import hp

from src import logger, notify, log_metrics
from src.indicators import (highest, lowest, med_price, avg_price, typ_price, 
                            atr, MAX, sma, bbands, macd, adx, sar, sarext, 
                            cci, rsi, crossover, crossunder, last, rci, 
                            double_ema, ema, triple_ema, wma, ewma, ssma, hull, 
                            supertrend, Supertrend, rsx, donchian, hurst_exponent,
                            lyapunov_exponent)
from src.exchange.bitmex.bitmex import BitMex
from src.exchange.binance_futures.binance_futures import BinanceFutures
from src.exchange.bitmex.bitmex_stub import BitMexStub
from src.exchange.binance_futures.binance_futures_stub import BinanceFuturesStub
from src.bot import Bot
from src.gmail_sub import GmailSub
from src.config import config as conf

# Candle tester for multiple timeframes
class CandleTesterMult(Bot):

    initialized = False

    def __init__(self):
        Bot.__init__(self, ['1m', '5m', '15m', '4h', '6h'])

    def initialize(self):
        if self.initialized:
            return            
        
        self.ohlcv = {}

        for i in self.bin_size:
            self.ohlcv[i] = open(f"candles/{self.pair}_{i}.csv", "w")
            self.ohlcv[i].write("time,open,high,low,close,volume\n") #header
            self.ohlcv[i].flush()
            
        self.initialized = True

    # this is for parameter optimization in hyperopt mode
    def options(self):
        return {}

    def strategy(self, action, open, close, high, low, volume):

        self.initialize()

        if action not in ['1m', '5m', '15m', '4h', '6h']:
            return

        logger.info(f"---------------------------")
        logger.info(f"Action: {action}")
        logger.info(f"---------------------------")
        logger.info(f"time: {self.exchange.timestamp}")
        logger.info(f"open: {open[-1]}")
        logger.info(f"high: {high[-1]}")
        logger.info(f"low: {low[-1]}")
        logger.info(f"close: {close[-1]}")
        logger.info(f"volume: {volume[-1]}") 
        logger.info(f"---------------------------")
        self.ohlcv[action].write(f"{self.exchange.timestamp},{open[-1]},{high[-1]},{low[-1]},{close[-1]},{volume[-1]}\n")
        self.ohlcv[action].flush()

        timestamp = datetime.now(timezone.utc)
        latency = timestamp - datetime.fromisoformat(self.exchange.timestamp)

        log_metrics(timestamp, "exchange", {
            "latency": round(latency.total_seconds())
        },
        {
            "exchange": conf["args"].exchange,
            "account": self.exchange.account,
            "pair": self.exchange.pair,
            "base_asset": self.exchange.base_asset,
            "quote_asset": self.exchange.quote_asset,
            "strategy": conf["args"].strategy,
            "tf": action
        })
