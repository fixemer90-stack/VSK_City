"""Destructive ONLY to an explicitly selected disposable vsk-ci-* test world."""
import time
import unittest

from test_http import AGENT, action, call, street
from scripts.ci_stack import run_compose


def docker(*args):
    command, service, *rest = args
    return run_compose([command, '-T', service, *rest] if command == 'exec' else [command, service, *rest])


def sql(command):
    return docker('exec', 'postgres', 'psql', '-U', 'vsk_pitch', '-d', 'vsk_pitch', '-Atc', command)


def ready():
    for _ in range(40):
        try:
            if call('/health')[0] == 200:
                return
        except (OSError, ValueError):
            pass
        time.sleep(1)
    raise AssertionError('Pitch stack did not become ready')


class PersistenceTests(unittest.TestCase):
    def setUp(self):
        ready()
        self.assertEqual(action('reset')[0], 200)

    def test_restart_preserves_world_deadline_offset_and_receipt(self):
        key='restart-pending-'+str(time.time_ns())
        self.assertEqual(action('advance-day')[0],200)
        _, before=action('terminate-property',key)
        snapshot=street(before)
        offset=sql("SELECT state->>'offsetSeconds' FROM pitch_world WHERE id=1")
        docker('restart','backend')
        ready()
        code,after=call('/api/demo/state')
        self.assertEqual(code,200)
        self.assertEqual(street(after),snapshot)
        self.assertEqual(sql("SELECT state->>'offsetSeconds' FROM pitch_world WHERE id=1"),offset)
        self.assertEqual(after['version'],before['version'])
        _,duplicate=action('terminate-property',key)
        self.assertEqual(street(duplicate),snapshot)
        self.assertEqual(duplicate['version'],before['version'])

    def test_redis_loss_health_failure_and_cache_rebuild(self):
        _,before=action('property')
        self.assertEqual(docker('exec','redis','redis-cli','DEL','pitch:world:version'),'1')
        docker('stop','redis')
        try:
            code,health=call('/health')
            self.assertEqual(code,503)
            self.assertEqual(health['postgres'],'up')
            self.assertEqual(health['redis'],'down')
            code,after=call('/api/demo/state')
            self.assertEqual(code,200)
            self.assertEqual(street(after),street(before))
        finally:
            docker('start','redis')
        ready()
        _,after=call('/api/demo/state')
        self.assertEqual(street(after),street(before))
        self.assertEqual(docker('exec','redis','redis-cli','GET','pitch:world:version'),str(after['version']))

    def test_worker_demolishes_without_get_or_action(self):
        _,pending=action('terminate-property')
        self.assertEqual(street(pending)['houses'][0]['status'],'pending_demolition')
        # Move only saved demo time directly in its isolated row, then observe DB only.
        # Unlike advance-day this does not itself run demolition, proving the worker path.
        sql("UPDATE pitch_world SET state=jsonb_set(state,'{offsetSeconds}',to_jsonb((state->>'offsetSeconds')::bigint+86400)) WHERE id=1")
        statement="SELECT jsonb_array_length(s->'houses') FROM pitch_world, jsonb_array_elements(state->'cities') c, jsonb_array_elements(c->'streets') s WHERE s->>'agentId'='"+AGENT+"'"
        for _ in range(25):
            if sql(statement)=='0':
                break
            time.sleep(1)
        self.assertEqual(sql(statement),'0')
        _,state=call('/api/demo/state')
        self.assertEqual(sum(p['spaces'] for p in street(state)['parking']),123)
        # Cleanup via an explicit new reset; tests do not leave changed clock/portfolio.
        self.assertEqual(action('reset')[0],200)


if __name__=='__main__':
    unittest.main(verbosity=2)
