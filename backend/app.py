"""
Flask application entry point for SkyRoute AI backend.
"""

import os
from flask import Flask, request, jsonify
from flask_cors import CORS

from geocode import resolve_airport, get_airports_df
from routes import generate_candidate_routes
from weather import analyze_route_weather
from agent import run_flight_advisor_agent

app = Flask(__name__)
CORS(app)


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "app": "SkyRoute AI"})


@app.route("/api/airports", methods=["GET"])
def search_airports():
    query = request.args.get("q", "").strip()
    if len(query) < 2:
        return jsonify({"airports": []})

    result = resolve_airport(query)
    if result.get("resolved"):
        return jsonify({"airports": [result["airport"]]})
    else:
        return jsonify({"airports": result.get("suggestions", [])})


@app.route("/api/find-route", methods=["POST"])
def find_route():
    try:
        data = request.get_json(force=True) or {}
        from_query = data.get("from", "").strip()
        to_query = data.get("to", "").strip()
        cruise_altitude = float(data.get("cruise_altitude_ft", 35000))
        cruise_speed = float(data.get("cruise_speed_kmh", 850))

        if not from_query:
            return jsonify({"success": False, "error": "Departure location ('From') is required."}), 400
        if not to_query:
            return jsonify({"success": False, "error": "Arrival destination ('To') is required."}), 400

        # 1. Resolve Origin Airport
        origin_res = resolve_airport(from_query)
        if not origin_res.get("resolved"):
            return jsonify({
                "success": False,
                "error": f"Could not find exact airport for '{from_query}'.",
                "field": "from",
                "suggestions": origin_res.get("suggestions", []),
            }), 422
        origin = origin_res["airport"]

        # 2. Resolve Destination Airport
        dest_res = resolve_airport(to_query)
        if not dest_res.get("resolved"):
            return jsonify({
                "success": False,
                "error": f"Could not find exact airport for '{to_query}'.",
                "field": "to",
                "suggestions": dest_res.get("suggestions", []),
            }), 422
        dest = dest_res["airport"]

        if origin["ident"] == dest["ident"]:
            return jsonify({
                "success": False,
                "error": "Departure and arrival airports cannot be identical.",
            }), 400

        # 3. Generate 3 candidate routes (Direct, Northern, Southern)
        candidate_routes = generate_candidate_routes(origin, dest, cruise_speed)

        # 4. Fetch live weather & analyze routes
        enriched_routes = []
        for r in candidate_routes:
            analyzed = analyze_route_weather(r, cruise_speed)
            enriched_routes.append(analyzed)

        # 5. Agentic AI ReAct loop with Gemini function calling
        agent_result = run_flight_advisor_agent(
            enriched_routes,
            cruise_altitude_ft=cruise_altitude,
            cruise_speed_kmh=cruise_speed
        )

        return jsonify({
            "success": True,
            "origin": origin,
            "destination": dest,
            "routes": enriched_routes,
            "agent": agent_result,
        })

    except Exception as e:
        app.logger.exception("Error processing flight route request")
        return jsonify({
            "success": False,
            "error": "Internal server error occurred while analyzing flight paths.",
            "details": str(e),
        }), 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=True)
