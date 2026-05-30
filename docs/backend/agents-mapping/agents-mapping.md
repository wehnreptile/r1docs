Requirements:

From admin:

1. As an admin i want to see all the available delivery agents & BUSY agents .
2. As an admin i want the system to recommend best agent for a particular order.  
   (input: order_id, output: all agents with distances)
3. As an admin i can be able to map an order to some IDLE agent.
4. As an admin i should be able to view all the order which are in READY_FOR_PICKUP state.

From Agents:

1. An agent can go ON/OFF duty . lets build an API for this /duty?status=ON/OFF
2. Periodic background & foreground location polling from the agent with a frequency of 3min . /location/update { lat, lng }

LLD:

1. All the agents who goes ON duty should be maintained in a Redis cache with an initial status of IDLE.
   { agent_Id: 302, name: "" , Contact: "", location: { lat, lng }, status: IDLE }
2. Whenever agent calls the location/update api with latest location, persist the location & reported_timestamp into the redis for that user.
3. Whenever an Order transitiones from ACCEPTED to READY_FOR_PICKUP along with persisting into postgres , now also maintain it into the Redis cache [ this helps for quick fetching on the admin side ].
4. Introudce a new intermediary status for Order i.e DELIVERY_AGENT_ASSIGNED
   prev: ACCEPTED -> READY_FOR_PICKUP -> PICKED_UP -> DELIVERED
   new: ACCEPTED -> READY_FOR_PICKUP -> DELIVERY_AGENT_ASSIGNED -> PICKED_UP -> DELIVERED
   READY_FOR_PICKUP -> DELIVERY_AGENT_ASSIGNED transition can only be done by Backend system or ADMIN user.
5. Build an API that fetches all the agents in the redis cache with a filter of status i.e IDLE, BUSY
6. Build an API that helps in recommending agents for a giver orderid.
   -> First checks IDLE agents
   -> Filters out nearby agents to the pharmacy (upto five agents) . Response should be sorted in increasing order of distance from pharmacy to agent location.
7. Build an API for duty status switching for the agent (ON/OFF) , this should also collect location data.
   - when user requests for ON duty check if the user present in redis or not, if not present insert a new record with all the necessary data of the agent. If present throw a BadRequestException back to client. [Maybe check if redis UPDATE handles this gracefully].
   - when goes OFF duty -> Throw exception if the user has any ongoing order (i.e if BUSY).Else just remove the agent from redis cache.
8. Build a location polling API for collecting the agent location and updating in the redis server.
   - Straight forwar update the location of the agent in redis cache.
9. Mapping API (Agent maps to an order , order status gets updated)
   order status.
   - Map agent_id to order.
   - Update the agent status from IDLE -> BUSY.
   - Remove the order from the redis cache (otherwise order will stay in redis forever).
   - Update the status of the order in postgres.

Priority:  
@aniket100200

1. Build agent related APIs first and caching logic. [create a package "agent" in the root folder].
2. Build features of ADMIN side, i.e manual mapping of orders to delivery agents.

For every backend thing:

- Decide the request/response first and raise a PR for it.
- Go for the core implementation.

@samudralaaravind

1. Build agent app first .
2. Build the admin portal [possibly integrate a dynamic page specifically in pharmacy portal]
