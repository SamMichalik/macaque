import pdb

from json import JSONEncoder
from neuralmonkey.vocabulary import END_TOKEN

class BeamSearchOutputGraphNode():
    def __init__(self, score, token, alignment, children = None):
        self._score = score
        self._token = token
        self._alignment = alignment

        if children is None:
            self._children = []
        else:
            self._children = children

    @property
    def score(self):
        return self._score

    @property
    def token(self):
        return self._token

    @property
    def alignment(self):
        return self._alignment

    @property
    def children(self):
        return self._children

    """
    def collect_hypotheses(self):
        hyps = []
        if self._children == []:
            return [[self._token]]
        for c in self._children:
            hyps.extend(c.collect_hypotheses())
        for h in hyps:
            h.append(self._token)
        return hyps
    """

    def collect_hypotheses(self):
        if self._token == END_TOKEN:
            return ([[]], [[]], [[]])

        elif self._children == []:
            return ([[self._token]], [[self._score]], [[self._alignment]])

        token_h = []
        score_h = []
        alignment_h = []

        for c in self._children:
            t, s, a = c.collect_hypotheses()
            token_h.extend(t)
            score_h.extend(s)
            alignment_h.extend(a)

        for t, s, a in zip(token_h, score_h, alignment_h):
            t.append(self._token)
            s.append(self._score)
            a.append(self._alignment)

        return (token_h, score_h, alignment_h)


class BeamSearchOutputGraph():
    def __init__(self,
                 scores,
                 tokens,
                 parent_ids,
                 alignments,
                 beam_size,
                 max_time):
        self._root = BeamSearchOutputGraphNode(0, "START", None)
        self._beam_size = beam_size

        opened_hyp = [self._root]

        for t in range(max_time):
            future_opened_hyp = []
            for b in range(beam_size):
                node = BeamSearchOutputGraphNode(score=scores[t,b].item(),
                                                 token=tokens[t][b],
                                                 alignment=alignments[t,b])
                opened_hyp[parent_ids[t,b]].children.append(node)
                future_opened_hyp.append(node)
            opened_hyp = future_opened_hyp

    @property
    def root(self):
        return self._root

    @property
    def beam_size(self):
        return self._beam_size

    """
    def collect_hypotheses(self):
        hyps = []
        for c in self._root.children:
            hyps.extend(c.collect_hypotheses())
        for h in hyps:
            h.reverse()
        return hyps
        """

    def collect_hypotheses(self):
        hyp_dict = self.collect_all_hypotheses()
        th = hyp_dict['tokens']
        sh = hyp_dict['scores']
        ah = hyp_dict['alignments']

        return {'tokens': th[:self._beam_size],
                'scores': sh[:self._beam_size],
                'alignments': ah[:self._beam_size]}

    def collect_all_hypotheses(self):
        th = []
        sh = []
        ah = []
        #hyps = []

        for c in self._root.children:
            t, s, a = c.collect_hypotheses()
            th.extend(t)
            sh.extend(s)
            ah.extend(a)

        for t, s, a in zip(th, sh, ah):
            t.reverse()
            s.reverse()
            a.reverse()
        #   hyps.append({'tokens': t, 'scores': s, 'alignments': a})
        #return hyps
        return {'tokens': th, 'scores': sh, 'alignments': ah}


class BeamSearchOutputGraphEncoder(JSONEncoder):
    def default(self, graph):
        return self._encode_node(graph.root)

    def _encode_node(self, node):
        enc_children = []
        if node.children != []:
            for c in node.children:
                enc_children.append(self._encode_node(c))

        if node.alignment is None:
            alig = []
        else:
            alig = node.alignment.tolist()

        return {'token': node.token,
                'score': node.score,
                'alignment': alig,
                'children': enc_children}
