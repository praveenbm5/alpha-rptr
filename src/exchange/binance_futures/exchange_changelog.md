2025-11-06

Effective on 2025-12-09, USDⓈ-M Futures will migrate conditional orders to the Algo Service, which will affect the following order types: STOP_MARKET/TAKE_PROFIT_MARKET/STOP/TAKE_PROFIT/TRAILING_STOP_MARKET.

The new endpoints for conditional orders of REST API :

- POST fapi/v1/algoOrder: Place an algo order
- DELETE /fapi/v1/algoOrder: Cancel an algo order
- DELETE fapi/v1/algoOpenOrders: Cancel all open algo orders
- GET /fapi/v1/algoOrder: Query an algo order
- GET /fapi/v1/openAlgoOrders: Query algo open order(s)
- GET /fapi/v1/allAlgoOrders: Query algo order(s)

The following enpoints will block the requests for order types after the migration: 

- STOP_MARKET
- TAKE_PROFIT_MARKET
- STOP
- TAKE_PROFIT
- TRAILING_STOP_MARKET. 

The error code -4120 STOP_ORDER_SWITCH_ALGO will be encountered from old endpoints as below.

- POST /fapi/v1/order
- POST /fapi/v1/batchOrders

Websocket User Stream Update

- New algo order event: ALGO_UPDATE

Websocket API Update

- New algo order : algoOrder.place
- Cancel algo order: algoOrder.cancel

Please note that after the migration:

No margin check before the conditional order gets triggered.
GTE_GTC orders no longer depend on open orders of the opposite side, but rather on positions only.
There should be no latency increase in order triggering.
Modification of untriggered conditional orders is not supported.