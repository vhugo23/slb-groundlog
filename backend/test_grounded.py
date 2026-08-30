from src.api import build_grounded_prompt, interpret_llm_response, call_llm

# The real GR summary you already retrieved and verified earlier.
context = {
    'mnemonic': 'GR',
    'unit': 'gAPI',
    'count': 20900,
    'min': 6.191505909,
    'max': 499.02258301,
    'mean': 63.12758151550053,
}

# Test 1: a question the data SHOULD answer.
prompt = build_grounded_prompt(context, "what does the GR log show, roughly?")
raw = call_llm(prompt)
grounded, answer = interpret_llm_response(raw)
print("--- Test 1 (should be grounded) ---")
print("RAW:", raw)
print("GROUNDED:", grounded)
print("ANSWER:", answer)

# Test 2: a question this exact context CANNOT answer (asks about a different curve).
prompt2 = build_grounded_prompt(context, "what is the NPHI porosity reading?")
raw2 = call_llm(prompt2)
grounded2, answer2 = interpret_llm_response(raw2)
print("\n--- Test 2 (should refuse) ---")
print("RAW:", raw2)
print("GROUNDED:", grounded2)
print("ANSWER:", answer2)