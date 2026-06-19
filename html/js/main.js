$.ajaxSetup({ cache: false });

backtest = {}

var EQUITY_COLOR = 'rgb(46, 139, 87)'
var UNREALIZED_UPPER_COLOR = 'rgba(245, 196, 66, 0.95)'
var UNREALIZED_LOWER_COLOR = 'rgba(183, 87, 28, 0.95)'
var UNREALIZED_UPPER_READOUT_COLOR = 'rgb(216, 155, 2)'
var UNREALIZED_LOWER_READOUT_COLOR = 'rgb(183, 87, 28)'
var MARKER_VISIBLE_RANGE = 500
var unrealized_series_visible = true
var equity_visible_range = null

var chart = LightweightCharts.createChart(document.getElementById("chart"), {
    width: 1000,
    height: 350,
    title: "Alpha RPTR",
    timeScale: {
    timeVisible: true,
    secondsVisible: true,
    minBarSpacing: 0.001
    },
    rightPriceScale: {
    visible: true
    },
    leftPriceScale: {
    visible: true,
    //invertScale: true
    },
});   

candleSeries = chart.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: 'rgb(38,166,154)',
    downColor: 'rgb(255,82,82)',
    wickUpColor: 'rgb(38,166,154)',
    wickDownColor: 'rgb(255,82,82)',
    borderVisible: false,
});

unrealized_upper_series = chart.addSeries(LightweightCharts.LineSeries, {
    color: UNREALIZED_UPPER_COLOR,
    lineWidth: 0.5,
    priceScaleId: 'left',
    lastValueVisible: false,
    priceLineVisible: false,
    visible: true
})

unrealized_lower_series = chart.addSeries(LightweightCharts.LineSeries, {
    color: UNREALIZED_LOWER_COLOR,
    lineWidth: 0.5,
    priceScaleId: 'left',
    lastValueVisible: false,
    priceLineVisible: false,
    visible: true
})

equity_chart_series = chart.addSeries(LightweightCharts.AreaSeries, {
    //title: "Equity",
    topColor: 'rgba(46, 139, 87, 0.1)',
    bottomColor: 'rgba(46, 139, 87, 0)',
    lineColor: EQUITY_COLOR,
    lineWidth: 0.5,
    priceScaleId: 'left',
    visible: true
})

drawdown_chart_series = chart.addSeries(LightweightCharts.AreaSeries, {
    //title: "DD%",
    topColor: 'rgba(255, 82, 82, 0.1)',
    bottomColor: 'rgba(255, 82, 82, 0)',
    lineColor: 'rgba(255, 82, 82, 1)',
    lineWidth: 0.5,
    priceScaleId: 'left',
    visible: false
})

chart.subscribeCrosshairMove((param) => {
    if (param.time) 
    {
        const price = param.seriesData.get(candleSeries);

        if (!price)
        {
            return
        }

        var color = price.open < price.close ? "seagreen" : "red"
        var title = '<span style="color: '+color+'">O: '+price.open+'</span> <span style="color: seagreen">H: '+price.high+'</span> <span style="color: red;">L: '+price.low+'</span> <span style="color: '+color+'">C: '+price.close+'</span>'
        title += get_unrealized_percent_title(param.seriesData)

        $("#chart_title").html(title);
    }
    else 
    {
        $("#chart_title").html('alpha rptr');
    }
});

function get_unrealized_percent_title(series_data)
{
    if (!unrealized_series_visible)
    {
        return ''
    }

    var equity = get_series_value(series_data, equity_chart_series)
    var upper = get_series_value(series_data, unrealized_upper_series)
    var lower = get_series_value(series_data, unrealized_lower_series)

    if (!isFinite(equity) || equity === 0 || !isFinite(upper) || !isFinite(lower))
    {
        return ''
    }

    var upper_pct = Math.max(((upper - equity) / equity) * 100, 0)
    var lower_pct = Math.min(((lower - equity) / equity) * 100, 0)

    if (!isFinite(upper_pct) || !isFinite(lower_pct) || (upper_pct === 0 && lower_pct === 0))
    {
        return ''
    }

    return ' <span style="color: #666">uPnL:</span> <span style="color: '+UNREALIZED_UPPER_READOUT_COLOR+'">'+format_percent(upper_pct)+'</span> <span style="color: '+UNREALIZED_LOWER_READOUT_COLOR+'">/ '+format_percent(lower_pct)+'</span>'
}

function get_series_value(series_data, series)
{
    var data = series_data.get(series)

    if (!data)
    {
        return NaN
    }

    return parseFloat(data.value)
}

function format_percent(value)
{
    var prefix = value > 0 ? '+' : ''
    return prefix + value.toFixed(2) + '%'
}

$('input[type=radio][name=ed_toggle]').change(function() {
    if (this.value == 'equity') {
        equity_chart_series.applyOptions({visible: true})
        drawdown_chart_series.applyOptions({visible: false})
        update_unrealized_series_visibility(chart.timeScale().getVisibleLogicalRange())
    }
    else if (this.value == 'drawdown') {
        equity_chart_series.applyOptions({visible: false})
        drawdown_chart_series.applyOptions({visible: true})
        set_unrealized_series_visibility(false)
    }
});

function set_unrealized_series_visibility(visible)
{
    unrealized_series_visible = visible
    unrealized_upper_series.applyOptions({visible: visible})
    unrealized_lower_series.applyOptions({visible: visible})
}

function update_unrealized_series_visibility(range)
{
    if (!range)
    {
        set_unrealized_series_visibility(false)
        return false
    }

    var visible_range = Math.floor(range["to"]) - Math.floor(range["from"])
    var markers_visible = visible_range <= MARKER_VISIBLE_RANGE
    var equity_mode = $('input[type=radio][name=ed_toggle]:checked').val() === 'equity'

    set_unrealized_series_visibility(equity_mode && markers_visible)
    return markers_visible
}

$('.button.code').click(function(event) {
    $.featherlight('<pre class="source_code"><code id="strategy_code" class="language-python">'+backtest.strategy_code+'</code></pre>', { variant: "srcmodal" }); 
    Prism.highlightElement(document.getElementById('strategy_code'));
    return false;
});

$('.button.fitchart').click(function(){
    fit_chart_to_equity_range()
})

$(document).ready(function(){

    var title = get_title()

    if (title)
    {
        load_backtest(title)
    }
    else
    {
        $.get( "/data/data.csv", function( data ) {
            
            chart_data = $.csv.toObjects(data);
            time_index = Object()
            time_length = chart_data.length
        
            for (var i=0; i<chart_data.length; i++)
            {
                var time = new Date(chart_data[i]["time"]).getTime()/1000
                chart_data[i]["time"] = time
                time_index[time] = i 
            }
        
            backtest.chart_data = chart_data
            load_chart(chart_data);
            get_load_trades(chart_data);  
            get_strategy_code()    
        
        });  
    } 
})

$('.button.save').click(function(event){
    var form = `
    <div class="save_form">
        <input class="save_title" type="text" placeholder="Name..."/>
        <button class="save_button"><span style="font-size: smaller">&#128190;</span> Save</button>
    </div>
    `;
    $.featherlight(form, {variant: "save_modal"})  
    $(".save_modal .save_title").focus()  
})

$('body').on("click", ".save_form .save_button", {}, function(event){

    var title = $(".save_form .save_title").val().trim()

    if (title.length > 0){

        backtest.saved = typeof backtest.saved == "undefined" ? moment().format("YYYY-MM-DD") 
                                    : backtest.saved

        $.post("/cgi-bin/db.py?key="+encodeURIComponent(title), JSON.stringify(backtest), function(data){

            if(data.result == "success")
            {
                $.get( "/cgi-bin/db.py?key=library", function( data ) {
            
                    library = data.result !== 'not-found' ? JSON.parse(data.library) : {}
            
                    var meta = Object.assign({}, backtest)
                    delete meta.chart_data 
                    delete meta.order_data 
                    delete meta.strategy_code
            
                    library[title] = meta
            
                    $.post("/cgi-bin/db.py?key=library", JSON.stringify(library), function(data){

                        if(data.result == 'success')
                        {
                            $(".header .title span").html(title)
                            set_title(title)
                            $.featherlight.close()
                        }
                        else modal_alert("Error", title+" could not be saved to Library! Try Again!")    
                    })
                }) 
            }
            else modal_alert("Error", title+" could not be saved!")           
        })       
    }
    else modal_alert("Error", "Please provide a valid name to the Backtest") 
})
  
/*-------------------------*/

function modal_alert(title, content)
{    
    var html = `
    <div class="message">
        <h3>{title}</h3>
        <p>{content}</p>
    </div>
    `;
    html = html.replace("{title}", title).replace("{content}", content)
    $.featherlight(html, {variant: "alert"})    
}

function modal_dialog(title, content, button, callback)
{    
    var id = Date.now()
    var html = `
    <div class="message" id="{id}">
        <h3>{title}</h3>
        <p>{content}</p>
        <div class=buttons-cont">
            <button class="confirm">{button}</button>
            <button class="cancel">Cancel</button>
        </div>
    </div>
    `;
    html = html.replace("{id}", id)
                .replace("{title}", title)
                .replace("{content}", content)
                .replace("{button}", button)
    $.featherlight(html, {variant: "dialog"})   
    
    $(".dialog #"+id+" .confirm").click(function(event){
        callback();
        $.featherlight.close()
    })

    $(".dialog #"+id+" .cancel").click(function(event){
        $.featherlight.close()
    })
}

$(".library").click(function(event){

    $.get( "/cgi-bin/db.py?key=library", function( data ) {

        if(data.result !== 'not-found')
        {   
            library = JSON.parse(data["library"])            
        }
        else modal_alert("Error", "Library is empty")

        library_table =  Array()

        for (const test in library) {
            var meta = library[test]
            var test_link = '<a class="test_link underline" target="_blank" data-title="' + escape_attr(test) + '" href="' + escape_attr(get_backtest_link(test )) + '">' + '♈ ' + escape_html(test) + '</a>'
            var delete_link = '<a class="delete_link" title="'+escape_attr(test)+'" href="#">⛔</a>'
            library_table.push([test_link, meta.cagr, meta.max_dd, meta.period, meta.start_date, meta.end_date, meta.saved, delete_link])
        }

        var html = `
        <div class="library_cont">
            <table id="backtests" class="display "></table>
        </div>
        `;
        //html = html.replace("{title}", title).replace("{content}", content)
        $.featherlight(html, {variant: "library_modal"})  

        $('#backtests').DataTable( {
            data: library_table,
            // searching: false,
            columns: [
                { title: 'Name' , width: '49%', className: "left-aligned-cell" },
                { title: 'CAGR%' },
                { title: 'MaxDD%' },
                { title: 'Period' },
                { title: 'Start' },
                { title: 'End' },
                { title: 'Saved' },
                { title: ' ', searchable: false, orderable: false }
            ]
        });
    })
})

function escape_html(value)
{
    return String(value).replace(/[&<>"']/g, function(char) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[char]
    })
}

function escape_attr(value)
{
    return escape_html(value)
}

$('body').on('click', '#backtests .test_link', function(event) {
    var title = $(this).attr("data-title")
    load_backtest_link(event, title)
})

function load_backtest_link(event, title)
{    
    load_backtest(title)
    $.featherlight.close()
    event.preventDefault()
}

$('body').on( 'click', '#backtests .delete_link', function () {

    var table = $('#backtests').DataTable();
    var title = $(this).attr("title")
    var element = this

    var message = "Do you really want to delete <b>"+title+"</b> from Library?"

    modal_dialog("Confirm Delete", message, "Delete", function(){

        $.get( "/cgi-bin/db.py?key=library", function( data ) {
                
            library = data.result !== 'not-found' ? JSON.parse(data.library) : {}

            if (typeof library[title] !== "undefined")
            {
                delete library[title]

                $.post("/cgi-bin/db.py?key=library", JSON.stringify(library), function(data){

                    if(data.result !== 'success')
                    modal_alert("Error", title+" could not be removed from Library! Try Again!")    
                })
            }             
            else modal_alert("Error", title+" is not in Library!")        
        }) 
        
        $.get( "/cgi-bin/db.py?do=delete&key="+encodeURIComponent(title), function( data ) {
            
            if(data.result == 'success'){
                table
                    .row( $(element).parents('tr') )
                    .remove()
                    .draw();
            }
            
        });
    })    

    return false
});

function load_backtest(title)
{
    $.get( "/cgi-bin/db.py?key="+encodeURIComponent(title), function( data ) {

        if(data.result !== 'not-found')
        {   
            backtest = JSON.parse(data[title])
            $(".header .title span").html(title)
            set_title(title)
            load_data(backtest.chart_data, backtest.order_data)
            
            fit_chart_to_equity_range()
        }
        else modal_alert("Error", "Backtest not found!")
    })
}

function load_data(chart_data, order_data)
{
    if ( $('#trades').children().length > 0 ) {
        $('#trades').DataTable().destroy()
        $('#trades').html('')
    }

    time_index = Object()
    time_length = chart_data.length

    for (var i=0; i<chart_data.length; i++)
    {
        time_index[chart_data[i]["time"]] = i
    }

    load_chart(chart_data)
    load_trades(chart_data, order_data)
}

/*-------------------------*/

function set_title(title)
{
    var url = new URL(window.location);
    url.searchParams.set('title', title);
    window.history.pushState({}, '', url);
}

function get_title()
{
    var url = new URL(window.location);
    var title = url.searchParams.get('title');

    return title
}

function get_backtest_link(title)
{
    var url = new URL(window.location);
    url.searchParams.set('title', title);
    return url.toString()
}


function load_chart(chart_data){
    candleSeries.setData(chart_data);
}    

function get_load_trades(chart_data){
    
    $.get( "/data/orders.csv", function( data ) {

        order_data = $.csv.toObjects(data);
        backtest.order_data = order_data
        load_trades(chart_data, order_data)

    })
}

function date_link(date)
{
    var time = new Date(date).getTime()/1000
    var chart_position = time_index[time]

    range = chart.timeScale().getVisibleLogicalRange();
    range = (Math.floor(range["to"]) - Math.floor(range["from"]))

    chart_position = chart_position - time_length + range/2
    chart.timeScale().scrollToPosition(chart_position,true)
    chart.priceScale().applyOptions({autoScale: true})
}

function fit_chart_to_equity_range()
{
    if (equity_visible_range)
    {
        chart.timeScale().setVisibleLogicalRange(equity_visible_range)
    }
    else
    {
        chart.timeScale().fitContent()
    }

    chart.priceScale().applyOptions({autoScale: true})
}

$('body').on('click', '.chart_link', function(event) {
    date_link($(this).attr("data-time"))
    event.preventDefault()
})

function format_number(price, sig_digits){
    price = parseFloat(price)
    return price >= 1 || price <= -1 ? (price % 1 == 0 ? price : price.toFixed(sig_digits)) : price.toPrecision(sig_digits)
}

function build_unrealized_balance_lines(chart_data, orders_by_time)
{
    var state = {
        position: 0,
        av_price: 0,
        balance: 0
    }

    var upper = []
    var lower = []

    for (var i=0; i<chart_data.length; i++)
    {
        var candle = chart_data[i]
        var time = parseInt(candle["time"])

        if (state.position !== 0 && state.av_price > 0 && isFinite(state.balance))
        {
            var high = parseFloat(candle["high"])
            var low = parseFloat(candle["low"])

            if (isFinite(high) && isFinite(low))
            {
                var favorable_price = state.position > 0 ? high : low
                var adverse_price = state.position > 0 ? low : high
                var favorable_balance = get_unrealized_balance(favorable_price, state)
                var adverse_balance = get_unrealized_balance(adverse_price, state)
                var upper_balance = Math.max(favorable_balance, adverse_balance)
                var lower_balance = Math.min(favorable_balance, adverse_balance)

                upper.push({time: time, value: Math.max(upper_balance, state.balance)})
                lower.push({time: time, value: Math.min(lower_balance, state.balance)})
            }
            else
            {
                upper.push({time: time})
                lower.push({time: time})
            }
        }
        else
        {
            if (isFinite(state.balance) && state.balance > 0)
            {
                upper.push({time: time, value: state.balance})
                lower.push({time: time, value: state.balance})
            }
            else
            {
                upper.push({time: time})
                lower.push({time: time})
            }
        }

        if (time in orders_by_time)
        {
            for (var j=0; j<orders_by_time[time].length; j++)
            {
                apply_order_state(state, orders_by_time[time][j])
            }
        }
    }

    return {upper: upper, lower: lower}
}

function get_unrealized_balance(price, state)
{
    var price_move = state.position > 0 ? price - state.av_price : state.av_price - price
    return state.balance + Math.abs(state.position) * price_move
}

function apply_order_state(state, order)
{
    var position = parseFloat(order["position"])
    var av_price = parseFloat(order["av_price"])
    var balance = parseFloat(order["balance"])

    state.position = isFinite(position) ? position : state.position
    state.av_price = isFinite(av_price) ? av_price : state.av_price
    state.balance = isFinite(balance) ? balance : state.balance
}

function format_metric_percent(value)
{
    return isFinite(value) ? value.toFixed(1) + '%' : '-'
}

function format_profit_factor(gross_profit, gross_loss)
{
    if (gross_loss > 0)
    {
        return (gross_profit / gross_loss).toFixed(2)
    }

    return gross_profit > 0 ? '∞' : '-'
}

function format_metric_number(value, digits)
{
    return isFinite(value) ? value.toFixed(digits) : '-'
}

function estimate_max_losing_streak(trades, loss_rate)
{
    if (trades === 0 || loss_rate === 0)
    {
        return 0
    }

    if (loss_rate === 1)
    {
        return trades
    }

    return Math.max(1, Math.floor(Math.log(trades) / -Math.log(loss_rate)))
}

function show_metrics_info()
{
    if (!backtest.metrics)
    {
        return
    }

    var metrics = backtest.metrics
    var html = `
    <div class="metrics_info_modal">
        <h3>Trade Metrics</h3>
        <table>
            <tr><td>Trades</td><td>{trades}</td></tr>
            <tr><td>Win Rate</td><td>{win_rate}</td></tr>
            <tr><td>Profit Factor</td><td>{profit_factor}</td></tr>
            <tr><td>Expectancy</td><td>{expectancy}</td></tr>
            <tr><td>Avg Win</td><td>{avg_win}</td></tr>
            <tr><td>Avg Loss</td><td>{avg_loss}</td></tr>
            <tr><td>Payoff Ratio</td><td>{payoff_ratio}</td></tr>
            <tr><td>Breakeven Win %</td><td>{breakeven_win_rate}</td></tr>
            <tr><td>Max Losing Streak</td><td>{max_losing_streak}</td></tr>
            <tr><td>Est. Max Losing Streak</td><td>{estimated_max_losing_streak}</td></tr>
        </table>
        <p>Est. Max Losing Streak uses the observed loss rate over the same trade count. PF affects trade quality, but it does not determine streak probability.</p>
    </div>
    `;

    html = html.replace("{trades}", metrics.closed_trades)
                .replace("{win_rate}", format_metric_percent(metrics.win_rate))
                .replace("{profit_factor}", metrics.profit_factor)
                .replace("{expectancy}", format_metric_number(metrics.expectancy, 2))
                .replace("{avg_win}", format_metric_number(metrics.avg_win, 2))
                .replace("{avg_loss}", format_metric_number(metrics.avg_loss, 2))
                .replace("{payoff_ratio}", format_metric_number(metrics.payoff_ratio, 2))
                .replace("{breakeven_win_rate}", format_metric_percent(metrics.breakeven_win_rate))
                .replace("{max_losing_streak}", metrics.max_losing_streak)
                .replace("{estimated_max_losing_streak}", metrics.estimated_max_losing_streak)

    $.featherlight(html, {variant: "metrics_info"})
}

$('body').on('click', '.metrics_info_button', function(event) {
    show_metrics_info()
    event.preventDefault()
})

function load_trades(chart_data, order_data){      

    var drawdown = {};
    var balance = {};
    var orders_by_time = {};

    backtest.start_date = null
    backtest.end_date = null     
    
    backtest.capital = 0
    backtest.nav = 0
    backtest.max_dd = 0

    var markers = [];
    var only_markers = [];

    var trades_table = Array()
    var winning_trades = 0
    var closed_trades = 0
    var gross_profit = 0
    var gross_loss = 0
    var current_losing_streak = 0
    var max_losing_streak = 0

    for (var i=0; i<order_data.length; i++){

        //"time,type,price,quantity,av_price,position,pnl,balance\n"

        if(i==0)
        {
            backtest.start_date = moment.utc(order_data[i]["time"])
            backtest.capital = parseInt(order_data[i]["balance"])
        }

        if(i==order_data.length-1)
        {
            backtest.end_date = moment.utc(order_data[i]["time"])
            backtest.nav = parseInt(order_data[i]["balance"])
        }

        var order_date = moment.utc(order_data[i]["time"]).format("YYYY-MM-DD HH:mm")        
        order_date = '<a class="chart_link underline" href="#" data-time="'+escape_attr(order_data[i]["time"])+'">📈 '+escape_html(order_date)+'</a>'

        var type = '<span class="'+order_data[i]["type"]+'">'+order_data[i]["id"]+'</span>'
        
        var number_formatter = Intl.NumberFormat('en-US', {
            notation: "compact",
            maximumSignificantDigits: 6
        });

        var quantity_formatted = format_number(order_data[i]["quantity"], 2)
        quantity_formatted = isNaN(quantity_formatted) ? '-' : (Math.abs(quantity_formatted) > 10**6 ? number_formatter.format(quantity_formatted) : quantity_formatted)
        quantity_formatted = '<div title="'+order_data[i]["quantity"]+'">'+quantity_formatted+'</div>'

        var position_formatted = format_number(order_data[i]["position"], 2)
        position_formatted = isNaN(position_formatted) ? '-' : (Math.abs(position_formatted) > 10**6 ? number_formatter.format(position_formatted) : position_formatted)
        position_formatted = '<div title="'+order_data[i]["position"]+'">'+position_formatted+'</div>'

        var pnl_formatted = parseFloat(order_data[i]["pnl"])
        var pnl = pnl_formatted
        if (isFinite(pnl) && pnl !== 0)
        {
            closed_trades += 1

            if (pnl > 0)
            {
                winning_trades += 1
                gross_profit += pnl
                current_losing_streak = 0
            }
            else
            {
                gross_loss += Math.abs(pnl)
                current_losing_streak += 1
                max_losing_streak = Math.max(max_losing_streak, current_losing_streak)
            }
        }

        pnl_formatted = isNaN(pnl_formatted) ? '-' : (Math.abs(pnl_formatted) > 10**6 ? number_formatter.format(pnl_formatted) : pnl_formatted)
        pnl_formatted = '<div title="'+order_data[i]["pnl"]+'">'+pnl_formatted+'</div>'

        var balance_formatted = order_data[i]["balance"]
        balance_formatted = isNaN(balance_formatted) ? '-' : (Math.abs(balance_formatted) > 10**6 ? number_formatter.format(balance_formatted) : balance_formatted)
        balance_formatted = '<div title="'+order_data[i]["balance"]+'">'+balance_formatted+'</div>'          
        
        var price_formatted = format_number(order_data[i]["price"], 2)
        var av_price_formatted = format_number(order_data[i]["av_price"], 2)
        
        trades_table.push([order_date, type, price_formatted, quantity_formatted, av_price_formatted, position_formatted, pnl_formatted, balance_formatted,order_data[i]["drawdown"]])

        var time = new Date(order_data[i]["time"]).getTime()/1000

        if (!(time in orders_by_time))
        {
            orders_by_time[time] = []
        }

        orders_by_time[time].push(order_data[i])

        //drawdown.push({ time: time, value: parseInt(order_data[i]["drawdown"]) });
        drawdown[time] = parseFloat(order_data[i]["drawdown"]);
        balance[time] = parseFloat(order_data[i]["balance"]);

        backtest.max_dd = drawdown[time] > backtest.max_dd ? drawdown[time] : backtest.max_dd

        if(order_data[i]["type"] == 'BUY')
        {
            markers.push({ time: time, position: 'belowBar', color: '#0345a1', shape: 'arrowUp', text: 'Buy @ ' + price_formatted + ' Qty: ' + order_data[i]["quantity"] });
            only_markers.push({ time: time, position: 'belowBar', color: '#0345a1', shape: 'arrowUp' });
        }        
        else  
        {
            markers.push({ time: time, position: 'aboveBar', color: "#870a01", shape: 'arrowDown', text: 'Sell @ ' + price_formatted + ' Qty: ' + order_data[i]["quantity"] });
            only_markers.push({ time: time, position: 'aboveBar', color: "#870a01", shape: 'arrowDown'});
        }          
    }

    backtest.period = backtest.end_date.diff(backtest.start_date, 'days')
    backtest.start_date = backtest.start_date.format("YYYY-MM-DD")    
    backtest.end_date = backtest.end_date.format("YYYY-MM-DD")    
    backtest.cagr = Math.round(((backtest.nav/backtest.capital)**(365/backtest.period)-1)*100)

    // Trade metrics are calculated from non-zero realized PnL rows.
    // Win Rate: winning trades / closed trades.
    // Profit Factor: gross profit / absolute gross loss.
    // Expectancy: average realized PnL per closed trade, in quote-currency units.
    // Payoff Ratio: average winning trade / average losing trade.
    // Breakeven Win %: win rate needed for expectancy to be zero at the observed avg win/loss.
    // Max Losing Streak: longest observed run of losing trades.
    // Est. Max Losing Streak: rough same-sample estimate using observed loss rate and trade count.
    var losing_trades = closed_trades - winning_trades
    var win_rate = closed_trades > 0 ? (winning_trades / closed_trades) * 100 : NaN
    var loss_rate = closed_trades > 0 ? losing_trades / closed_trades : 0
    var avg_win = winning_trades > 0 ? gross_profit / winning_trades : NaN
    var avg_loss = losing_trades > 0 ? gross_loss / losing_trades : NaN
    var payoff_ratio = isFinite(avg_win) && isFinite(avg_loss) && avg_loss > 0 ? avg_win / avg_loss : NaN
    var expectancy = closed_trades > 0 ? (gross_profit - gross_loss) / closed_trades : NaN
    var breakeven_win_rate = isFinite(avg_win) && isFinite(avg_loss) ? (avg_loss / (avg_win + avg_loss)) * 100 : NaN

    backtest.metrics = {
        closed_trades: closed_trades,
        win_rate: win_rate,
        profit_factor: format_profit_factor(gross_profit, gross_loss),
        expectancy: expectancy,
        avg_win: avg_win,
        avg_loss: avg_loss,
        payoff_ratio: payoff_ratio,
        breakeven_win_rate: breakeven_win_rate,
        max_losing_streak: max_losing_streak,
        estimated_max_losing_streak: estimate_max_losing_streak(closed_trades, loss_rate)
    }

    $(".props").html("CAGR: "+backtest.cagr+"% &bull; MaxDD: "+backtest.max_dd+"% &bull; Trades: "+closed_trades+" &bull; "+backtest.period+" days &bull; "+backtest.start_date+" - "+backtest.end_date+" <button class=\"metrics_info_button\" title=\"Trade metrics\">i</button>")

    var drawdown_series = [];
    var balance_series = [];
    equity_visible_range = null

    var last_drawdown = 0
    var last_balance = 0
    var first_equity_index = null
    var last_equity_index = null

    for (var i=0; i<chart_data.length; i++){

        let time = chart_data[i]["time"];

        drawdown_series.push({time: time, value: last_drawdown})

        balance_series.push({time: time, value: last_balance})

        if (isFinite(last_balance) && last_balance !== 0)
        {
            if (first_equity_index === null)
            {
                first_equity_index = i
            }

            last_equity_index = i
        }

        if ( time in drawdown)
        {
            last_drawdown = drawdown[time]
        }

        if ( time in balance)
        {
            last_balance = balance[time]
        }
    }

    if (chart_data.length > 0)
    {
        var last_chart_time = chart_data[chart_data.length - 1]["time"]

        if (last_chart_time in drawdown)
        {
            drawdown_series[drawdown_series.length - 1].value = last_drawdown
        }

        if (last_chart_time in balance)
        {
            balance_series[balance_series.length - 1].value = last_balance

            if (isFinite(last_balance) && last_balance !== 0)
            {
                if (first_equity_index === null)
                {
                    first_equity_index = chart_data.length - 1
                }

                last_equity_index = chart_data.length - 1
            }
        }
    }

    if (first_equity_index !== null && last_equity_index !== null)
    {
        if (first_equity_index === last_equity_index)
        {
            equity_visible_range = {from: first_equity_index - 1, to: last_equity_index + 1}
        }
        else
        {
            equity_visible_range = {from: first_equity_index, to: last_equity_index}
        }
    }

    equity_chart_series.setData(balance_series);      
    drawdown_chart_series.setData(drawdown_series);

    var unrealized_balance_lines = build_unrealized_balance_lines(chart_data, orders_by_time)
    unrealized_upper_series.setData(unrealized_balance_lines.upper);
    unrealized_lower_series.setData(unrealized_balance_lines.lower);
    
    // Create a markers primitive instance
    const seriesMarkers = LightweightCharts.createSeriesMarkers(candleSeries, []);

    seriesMarkers.setMarkers(markers);

    function onVisibleLogicalRangeChanged(range) {
        console.log(range);
        if (!range)
        {
            update_unrealized_series_visibility(range)
            seriesMarkers.setMarkers([]);
            return
        }

        var start = parseInt(range["from"]);
        var end = parseInt(range["to"]);

        update_unrealized_series_visibility(range)

        if(end-start > MARKER_VISIBLE_RANGE)
        seriesMarkers.setMarkers([]);
        else if (end-start > 200)
        seriesMarkers.setMarkers(only_markers);
        else
        seriesMarkers.setMarkers(markers);
    }

    chart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChanged);
    onVisibleLogicalRangeChanged(chart.timeScale().getVisibleLogicalRange());
    
    $('#trades').DataTable( {
        data: trades_table,
        // searching: false,
        columns: [
            { title: 'Date' },
            { title: 'Type' },
            { title: 'Price' },
            { title: 'Quantity' },
            { title: 'Av. Price' },
            { title: 'Position' },
            { title: 'PnL' },
            { title: 'Balance' },
            { title: 'Drawdown' }
        ]
    });
}   

function get_strategy_code()
{
    $.get( "/data/strategy.py", function( data ) {
        backtest.strategy_code = data    
    });   
}
