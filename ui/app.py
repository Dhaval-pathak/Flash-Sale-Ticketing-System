import os
import requests
import streamlit as st

API_URL = os.getenv('API_URL', 'http://localhost:3000')

st.title('Flash Sale Demo')
st.caption('Minimal UI for event inventory and reservation flow demo')

st.subheader('Events & Inventory')

try:
    response = requests.get(f"{API_URL}/api/events", timeout=5)
    response.raise_for_status()
    events = response.json()

    if not events:
      st.info('No events available.')
    for e in events:
        st.markdown(f"**{e['title']}** ({e['ticket_type']})")
        st.write(f"Remaining: {e['remaining_capacity']} / {e['total_capacity']}")
        st.write(f"Price: ${e['price']}")
        st.divider()
except Exception as ex:
    st.error(f"Failed to fetch events from API ({API_URL}): {ex}")
