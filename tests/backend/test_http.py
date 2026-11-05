import concurrent.futures
import json
import os
import unittest
import urllib.error
import urllib.request
import uuid

BASE = os.environ.get('PITCH_URL', 'http://127.0.0.1:5189')
AGENT = 'TEST-AGENT-001-044'


def call(path, body=None, role='agent', agent=AGENT):
    url = BASE + path
    if path != '/health':
        url += '?agentId=' + agent + '&role=' + role
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        with error:
            return error.code, json.load(error)


def action(kind, key=None, role='agent', agent=AGENT):
    return call('/api/demo/actions', {'agentId': agent, 'type': kind, 'requestId': key or str(uuid.uuid4())}, role, agent)


def street(state, agent=AGENT):
    return next(s for c in state['cities'] for s in c['streets'] if s['agentId'] == agent)


class HttpTests(unittest.TestCase):
    def setUp(self):
        code, data = action('reset')
        self.assertEqual(code, 200, data)

    def test_health_real_dependencies(self):
        code, body = call('/health')
        self.assertEqual(code, 200)
        self.assertEqual(body['postgres'], 'up')
        self.assertEqual(body['redis'], 'up')

    def test_seed_and_exact_contract(self):
        code, state = call('/api/demo/state')
        self.assertEqual(code, 200)
        self.assertEqual(set(state), {'mode', 'version', 'now', 'viewer', 'cities'})
        self.assertEqual(len(state['cities']), 25)
        self.assertTrue(all(len(c['streets']) == 50 for c in state['cities']))
        self.assertEqual(sum(len(s['houses']) for c in state['cities'] for s in c['streets']), 4175)
        self.assertEqual(sum(sum(h['xp'] for h in s['houses']) + sum(p['spaces'] for p in s['parking']) for c in state['cities'] for s in c['streets']), 28775)
        self.assertEqual(state['viewer']['streetId'], 'STREET-' + AGENT)
        self.assertEqual(set(street(state)), {'id','agentId','name','scenario','houses','parking'})
        self.assertEqual(set(street(state)['houses'][0]), {'id','lotIndex','xp','tier','floors','status','demolishAt'})

    def test_privacy_and_director_observer(self):
        for role, visible in [('agent', 1), ('director', 50)]:
            code, state = call('/api/demo/state', role=role)
            self.assertEqual(code, 200)
            self.assertEqual(sum(s['name'] is not None for c in state['cities'] for s in c['streets']), visible)
        self.assertEqual(action('motor', role='director')[0], 403)
        self.assertEqual(action('advance-day', role='director')[0], 200)

    def test_invalid_requests_json(self):
        for role, agent, expected in [('unknown',AGENT,400),('agent','invalid',404)]:
            code, body = call('/api/demo/state',role=role,agent=agent)
            self.assertEqual(code,expected)
            self.assertIn('message',body)
        self.assertEqual(action('invalid')[0],400)
        self.assertEqual(action('motor',key='bad key')[0],400)
        self.assertEqual(call('/api/demo/actions',{})[0],400)

    def test_idempotent_concurrent_sale(self):
        key=str(uuid.uuid4())
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            results=list(pool.map(lambda _: action('property',key), range(8)))
        self.assertTrue(all(code==200 for code,_ in results))
        _, state=call('/api/demo/state')
        self.assertEqual(len(street(state)['houses']),2)
        self.assertEqual(action('motor',key)[0],409)

    def test_pending_then_day_preserves_motor(self):
        key=str(uuid.uuid4())
        code, pending=action('terminate-property',key)
        self.assertEqual(code,200)
        house=street(pending)['houses'][0]
        self.assertEqual(house['status'],'pending_demolition')
        _, duplicate=action('terminate-property',key)
        self.assertEqual(street(duplicate)['houses'][0]['demolishAt'],house['demolishAt'])
        _, motor=action('motor')
        self.assertEqual(street(motor)['houses'][0]['xp'],100)
        _, after=action('advance-day')
        self.assertEqual(street(after)['houses'],[])
        self.assertEqual(sum(p['spaces'] for p in street(after)['parking']),124)

    def test_reset_idempotent(self):
        key=str(uuid.uuid4())
        self.assertEqual(action('reset',key)[0],200)
        self.assertEqual(action('property')[0],200)
        code,state=action('reset',key)
        self.assertEqual(code,200)
        self.assertEqual(len(street(state)['houses']),2)


if __name__ == '__main__':
    unittest.main(verbosity=2)
